import { createConfig, http } from "wagmi";
import { localAnvil, sepolia } from "@execution-kernel-protocol/config";
import { injectedLocalDisconnect } from "./injectedLocalDisconnect";

/**
 * Local anvil (dev) plus Sepolia (the one real testnet this repo targets --
 * see docs/architecture/testnet-deployment.md) -- connect a browser wallet
 * pointed at either to use this app. Not a general multi-chain config: just
 * these two, matching the two KernelDeploymentConfigs packages/config
 * actually knows about (see deploymentsByChainId).
 *
 * Sepolia's transport uses a specific public RPC (verified reachable) rather
 * than viem's bundled default -- an explicit, known-good endpoint rather
 * than an implicit one.
 *
 * ssr: true is required here, not optional — without it wagmi's hooks
 * report "disconnected, no connectors" on the server (no wallet exists
 * during SSR) but read the real injected wallet state on the client's
 * first render, and those two renders disagreeing is a React hydration
 * mismatch. Any real visitor with a wallet extension installed would hit
 * this, not just an injected test provider.
 *
 * connectors: [injectedLocalDisconnect()] -- not the stock `injected()`,
 * and multiInjectedProviderDiscovery is explicitly off, deliberately, as
 * one decision: see injectedLocalDisconnect.ts for why Disconnect must not
 * call wallet_revokePermissions. That fix only helps if every connector the
 * app can render goes through it -- with EIP-6963 discovery left on, wagmi
 * auto-adds a *separate*, real stock `injected()` connector for MetaMask's
 * own announcement (this is exactly why production showed two buttons,
 * "Connect Injected" and "Connect MetaMask"), which would keep calling the
 * real revoke on disconnect regardless of anything configured here.
 * Discovery has no supported hook to wrap/replace the connectors it
 * creates, so turning it off and keeping a single explicit, wrapped
 * connector is the only way to guarantee there is no bypass -- one
 * "Connect Injected" control instead of two. This app's model was already
 * "one browser wallet, pointed at anvil or Sepolia," not multi-wallet
 * selection, so this doesn't remove a capability the app relied on.
 */
export const wagmiConfig = createConfig({
  chains: [localAnvil, sepolia],
  connectors: [injectedLocalDisconnect()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [localAnvil.id]: http(),
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
