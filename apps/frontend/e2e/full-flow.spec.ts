/**
 * The complete real flow, driven end to end through a real headless browser
 * against the actual Next.js dev server, actual wagmi hooks, actual sdk
 * calls, a real anvil chain, the real apps/indexer package, and the real
 * apps/api server:
 *
 *   connect wallet -> read registry -> construct intent -> simulate ->
 *   wallet confirmation -> executeIntent() -> transaction confirmed ->
 *   indexer observes event -> API exposes updated metrics ->
 *   frontend displays result
 *
 * No real MetaMask extension exists in this environment, so the one thing
 * replaced is the wallet's UI popup: an EIP-1193 provider is injected into
 * the page (both legacy window.ethereum and EIP-6963 announcement, so
 * wagmi's injected() connector finds it either way) that proxies every RPC
 * call straight to anvil. anvil auto-signs eth_sendTransaction for its own
 * unlocked default accounts (confirmed with a raw curl before writing this),
 * so no private key material is needed in the browser at all -- the
 * frontend code path (wagmi -> sdk -> executeIntent) is exercised exactly
 * as it would be with a real wallet, just without a human clicking
 * "Confirm" in a popup.
 *
 * Requires, running before `npm run e2e` (see this repo's README):
 *   - anvil, with the full kernel deployed via the same sequence
 *     packages/sdk/examples/quickstart.ts documents
 *   - apps/api running on LOCAL_API_URL (packages/config)
 * The frontend dev server itself is started by playwright.config.ts.
 */
import { test, expect } from "@playwright/test";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createExecutionKernelClient } from "@execution-kernel-protocol/sdk";
import { createIndexer } from "@execution-kernel-protocol/indexer";
import { localAnvil, localAnvilAddresses, localAnvilModules, ROUTE_INTENT_TYPE, LOCAL_API_URL } from "@execution-kernel-protocol/config";

// anvil's default account #0 -- well-known local-only test key.
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ACCOUNT: Address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

test.beforeAll(async () => {
  // Wire the intent + both modules through the real sdk first (an admin
  // action, not something the frontend's UI does) -- same setup every other
  // example script in this repo does, via the same client this whole app
  // is built on.
  const account = privateKeyToAccount(PK);
  const publicClient = createPublicClient({ chain: localAnvil, transport: http() });
  const walletClient = createWalletClient({ chain: localAnvil, transport: http(), account });
  const kernel = createExecutionKernelClient({ addresses: localAnvilAddresses, publicClient, walletClient });

  const alreadyActive = await kernel.intentRegistry.isIntentActive(ROUTE_INTENT_TYPE);
  if (!alreadyActive) {
    await kernel.intentRegistry.registerIntent(ROUTE_INTENT_TYPE, "Route");
    await kernel.moduleRegistry.registerModule(ROUTE_INTENT_TYPE, localAnvilModules.routerModule);
    await kernel.moduleRegistry.registerModule(ROUTE_INTENT_TYPE, localAnvilModules.mevProtectionModule);
  }
});

test("connect wallet -> read registry -> construct intent -> simulate -> executeIntent -> indexer -> api -> frontend displays result", async ({ page }) => {
  // Baseline, straight from apps/api, before this test executes anything --
  // read directly from a live server, not asserted against zero, so this
  // test is safe to re-run against a chain that already has history.
  const before: { totalExecutions: number } = await (
    await fetch(`${LOCAL_API_URL}/metrics/executions?intentType=${ROUTE_INTENT_TYPE}`)
  ).json();

  // Inject the fake wallet before any page script runs.
  await page.addInitScript(
    ({ account, rpcUrl, chainIdHex }) => {
      async function rpc(method: string, params: unknown[]) {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
        });
        const json = await res.json();
        if (json.error) {
          const err = new Error(json.error.message ?? "RPC error") as Error & { code?: number };
          err.code = json.error.code;
          throw err;
        }
        return json.result;
      }

      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

      // Real wallets only return an account from the SILENT eth_accounts
      // check once the site has actually been granted permission -- a
      // fresh page load with no prior connection gets []. Getting this
      // wrong (returning the account unconditionally) makes wagmi's
      // auto-reconnect-on-mount silently "connect" before the test ever
      // gets to click anything, which isn't what a real first-time visitor
      // would experience.
      let connected = false;

      const provider = {
        isMetaMask: false,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_requestAccounts") {
            connected = true;
            return [account];
          }
          if (method === "eth_accounts") return connected ? [account] : [];
          if (method === "eth_chainId") return chainIdHex;
          if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
          return rpc(method, params ?? []);
        },
        on: (event: string, cb: (...args: unknown[]) => void) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeListener: (event: string, cb: (...args: unknown[]) => void) => {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((l) => l !== cb);
        },
      };

      // Legacy injection.
      (window as unknown as { ethereum: unknown }).ethereum = provider;

      // EIP-6963 multi-wallet discovery, which wagmi's injected() connector
      // prefers when available.
      const info = {
        uuid: "e2e-fake-wallet-0000-0000-000000000000",
        name: "E2E Test Wallet",
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        rdns: "protocol.e2e.test-wallet",
      };
      function announce() {
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }),
        );
      }
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { account: ACCOUNT, rpcUrl: localAnvil.rpcUrls.default.http[0], chainIdHex: "0x7a69" },
  );

  // 1. connect wallet
  // wagmi's multiInjectedProviderDiscovery means BOTH the legacy
  // window.ethereum assignment and the EIP-6963 announcement below
  // register as separate connectors -- correctly, that's what lets a real
  // user with several real wallets installed pick between them. Target
  // this fake wallet by its specific announced name, not an ordinal
  // .first(), so this doesn't race against however many connectors exist.
  await page.goto("/");
  await page.getByRole("button", { name: /E2E Test Wallet/ }).click();
  // ConnectWallet.tsx renders `${address.slice(0, 6)}...${address.slice(-4)}`.
  await expect(page.getByText(/0xf39F\.\.\.2266/)).toBeVisible({ timeout: 15_000 });

  // 2. read registry (useIntents -> kernel.intentRegistry.getAllIntents/getIntent)
  const intentButton = page.getByRole("button", { name: /Route/i });
  await expect(intentButton).toBeVisible({ timeout: 15_000 });

  // 3. construct intent -- selecting the registered intent type is what
  // constructs the {intentType, intentData: "0x"} Intent object this app
  // hands to executeIntent(); there's no separate params form because
  // RouterModule/MevProtectionModule don't read intentData yet.
  await intentButton.click();
  await expect(page.getByText(ROUTE_INTENT_TYPE, { exact: false })).toBeVisible();

  // 4. simulate -- off-chain, gas-free (execution-node's solve(), via
  // usePrediction). Strengthened, not just carried over: the redesigned
  // console shows every candidate's real score, not just the winner's tag,
  // so assert the competition itself is visible -- both real modules
  // present with a score each, and exactly one marked "Selected".
  await expect(page.getByText("Router Module")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("MEV Protection Module")).toBeVisible();
  await expect(page.getByText("Selected", { exact: true })).toBeVisible();

  // 5/6/7. wallet confirmation (auto-approved by the injected provider,
  // in place of a human clicking "Confirm") -> executeIntent() -> submitted
  await page.getByRole("button", { name: /Execute intent/i }).click();
  const txLocator = page.getByText(/^tx: 0x/);
  await expect(txLocator).toBeVisible({ timeout: 20_000 });
  const txText = await txLocator.textContent();
  const hash = txText!.replace("tx:", "").trim() as `0x${string}`;

  // 7 (continued). transaction confirmed -- checked explicitly, not assumed
  // from anvil's auto-mine timing.
  const publicClient = createPublicClient({ chain: localAnvil, transport: http() });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");

  // 8. indexer observes event -- the real apps/indexer package, called
  // directly here (not through apps/api), to prove this layer independently
  // of the API that wraps it.
  const indexer = await createIndexer({ publicClient, addresses: localAnvilAddresses });
  expect(indexer.totalExecutions(ROUTE_INTENT_TYPE)).toBe(before.totalExecutions + 1);

  // 9. API exposes updated metrics -- a separate process, a separate HTTP
  // call, hitting the real running apps/api server.
  await expect
    .poll(
      async () => {
        const res = await fetch(`${LOCAL_API_URL}/metrics/executions?intentType=${ROUTE_INTENT_TYPE}`);
        const json = await res.json();
        return json.totalExecutions;
      },
      { timeout: 15_000 },
    )
    .toBe(before.totalExecutions + 1);

  // 10. frontend displays result -- both its own execution result (tx hash,
  // asserted above) and the metrics panel, refetched from apps/api after
  // execution, in the same running page.
  await expect(page.getByText(new RegExp(`Total executions: ${before.totalExecutions + 1}`))).toBeVisible({
    timeout: 15_000,
  });

  // Also: the new Recent executions panel (apps/api's /executions,
  // wrapping apps/indexer's raw per-transaction records, previously never
  // exposed) shows this exact transaction -- a second, independent path
  // from indexer through api to the frontend for the same event.
  const truncatedHash = `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  await expect(page.getByText(truncatedHash)).toBeVisible({ timeout: 15_000 });
});
