"use client";

import { useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { ResourceUnavailableRpcError } from "viem";
import { Dot } from "@/components/ui/Badge";

/**
 * The actual lifecycle problem (see PR #31, which only made this failure
 * visible -- it did not fix it): wagmi's injected() connector calls
 * wallet_revokePermissions on disconnect (real MetaMask MIP-2 support), but
 * @wagmi/core's disconnect() action only waits up to 100ms locally for it
 * (a hardcoded withTimeout inside the library, not something this app can
 * configure) before giving up and flipping local state to "disconnected."
 * The real wallet extension keeps revoking in the background regardless of
 * that local timeout -- MetaMask serializes permission-affecting requests
 * per origin, so a second one (wallet_requestPermissions, issued by the
 * very next connect()) arriving before the first has actually finished on
 * the wallet side gets rejected with RPC code -32002 ("already
 * processing"), which the connector rethrows outright.
 *
 * In other words: ExeKPro's own UI, not MetaMask, is what exposes the
 * Connect action before the previous disconnect has genuinely settled --
 * wagmi's local "disconnected" state is not the same event as "the wallet
 * has actually finished revoking," and the UI was treating them as one.
 * PR #31 treated the resulting -32002 as an error to retry after the fact;
 * that's reactive and, by construction, can only ever be as reliable as its
 * fixed retry budget against a real-world delay of unknown/variable length.
 *
 * The fix here is proactive coordination instead: after disconnecting,
 * poll the SAME connector's getAccounts() (eth_accounts -- a read-only
 * call, not a permission request, so it never itself contends for the
 * wallet's per-origin request queue) until it actually confirms the
 * account list is empty, i.e. the revoke has genuinely taken effect on the
 * wallet side. Connect stays disabled and visibly "Finishing disconnect..."
 * for that (typically very short, often near-instant) real window, instead
 * of silently racing it. The bounded -32002 retry from PR #31 is kept as a
 * last-resort safety net (e.g. if the poll ceiling below is reached without
 * confirmation), not as the primary defense.
 *
 * Confirmed by reproduction (see e2e/_diag-reconnect.spec.ts, not part of
 * the permanent suite, run manually against a mock wallet that models a
 * wallet_revokePermissions call slower than wagmi's 100ms budget): without
 * this wait, "Connect -> Disconnect -> Connect" surfaces the raw -32002
 * message on the very first reconnect attempt every time that race is hit.
 */
const SETTLE_POLL_INTERVAL_MS = 150;
// Generous, not arbitrary: MetaMask's MV3 background service worker can
// need real time to wake up and process a queued request (a documented
// class of extension behavior, independent of this app). This is a ceiling
// on how long Connect stays disabled waiting for confirmation, not a fixed
// delay -- the poll below returns as soon as eth_accounts actually clears,
// which in practice is almost always well under this.
const SETTLE_MAX_WAIT_MS = 3_000;

const RETRY_DELAY_MS = 350;
const MAX_ATTEMPTS = 3;

function isResourceUnavailable(error: unknown): boolean {
  if (error instanceof ResourceUnavailableRpcError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === ResourceUnavailableRpcError.code
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for the wallet to actually confirm the disconnect (eth_accounts
 * empty) rather than assuming wagmi's local "disconnected" state means the
 * same thing. Returns as soon as confirmed; gives up silently at the
 * ceiling so a slow/unusual wallet never permanently blocks reconnecting --
 * the -32002 retry in handleConnect is the fallback for that case.
 */
async function waitForWalletToSettle(connector: Connector) {
  const deadline = Date.now() + SETTLE_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const accounts = await connector.getAccounts();
      if (accounts.length === 0) return;
    } catch {
      // A transient read failure here isn't a reason to give up early --
      // just keep polling until the deadline.
    }
    await sleep(SETTLE_POLL_INTERVAL_MS);
  }
}

export function ConnectWallet() {
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [busyConnectorUid, setBusyConnectorUid] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  // Non-null while a just-disconnected connector's revoke is still being
  // confirmed -- gates Connect regardless of which render branch is active,
  // since isConnected can already be false before this settles.
  const [settlingConnector, setSettlingConnector] = useState<Connector | null>(null);
  // Guards against a disconnect->reconnect->disconnect double-click racing
  // its own settle-wait with a newer one for a different connector.
  const settleTokenRef = useRef(0);

  async function handleDisconnect(connector: Connector | undefined) {
    const token = ++settleTokenRef.current;
    if (connector) setSettlingConnector(connector);
    try {
      await disconnectAsync();
    } catch {
      // Best-effort: disconnect() itself has nothing further this UI can
      // usefully retry (wagmi's own connector.disconnect() already swallows
      // its own wallet_revokePermissions failures). Still fall through to
      // the settle-wait below so Connect isn't re-enabled prematurely.
    } finally {
      if (connector) {
        await waitForWalletToSettle(connector);
        if (settleTokenRef.current === token) setSettlingConnector(null);
      }
    }
  }

  async function handleConnect(connector: Connector) {
    setConnectError(null);
    setBusyConnectorUid(connector.uid);
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          setRetrying(attempt > 1);
          await connectAsync({ connector });
          return;
        } catch (error) {
          if (isResourceUnavailable(error) && attempt < MAX_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          setConnectError(
            isResourceUnavailable(error)
              ? "Wallet is still finishing the previous request -- please try again in a moment."
              : error instanceof Error
                ? error.message
                : "Failed to connect wallet.",
          );
          return;
        }
      }
    } finally {
      setBusyConnectorUid(null);
      setRetrying(false);
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink">
          <Dot tone="success" />
          {/* Exact format: full-flow.spec.ts asserts this truncation exactly. */}
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => handleDisconnect(activeConnector)}
          disabled={settlingConnector !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const isSettling = settlingConnector !== null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {connectors.map((connector) => {
          const isBusy = busyConnectorUid === connector.uid;
          const label = isSettling
            ? "Finishing disconnect..."
            : isBusy && retrying
              ? "Reconnecting..."
              : `Connect ${connector.name}`;
          return (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={isSettling || busyConnectorUid !== null}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {label}
            </button>
          );
        })}
      </div>
      {connectError && <span className="text-xs text-danger">{connectError}</span>}
    </div>
  );
}
