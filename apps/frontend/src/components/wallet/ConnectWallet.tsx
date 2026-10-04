"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { Dot } from "@/components/ui/Badge";

/**
 * No wallet-side permission lifecycle to coordinate here anymore -- see
 * lib/injectedLocalDisconnect.ts. ExeKPro's Disconnect only ends the app
 * session (ordinary wagmi state), it never calls wallet_revokePermissions,
 * so there's nothing pending on the wallet side for a reconnect to race.
 * connect()/disconnect() are plain, immediate wagmi calls -- no settle-wait
 * polling, no bounded retry, no "Finishing disconnect..." state. (That
 * machinery, from PR #31/#32, existed only to work around the revoke race;
 * see their git history if it's ever needed for reference.)
 *
 * A reconnect may succeed without MetaMask showing a popup, if MetaMask
 * still considers exekpro.com authorized (since disconnecting in ExeKPro
 * never revoked that) -- that's expected, not a bug. A user who wants to
 * revoke the site's MetaMask permission itself still can, from inside
 * MetaMask.
 */
export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect();
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect(connector: Connector) {
    setConnectError(null);
    try {
      await connectAsync({ connector });
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Failed to connect wallet.");
    }
  }

  async function handleDisconnect() {
    setConnectError(null);
    try {
      await disconnectAsync();
    } catch (error) {
      // Local disconnect no longer makes a wallet RPC, but storage/config
      // failures are still real errors and should not disappear silently.
      setConnectError(error instanceof Error ? error.message : "Failed to disconnect wallet.");
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink">
            <Dot tone="success" />
            {/* Exact format: full-flow.spec.ts asserts this truncation exactly. */}
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnectPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
        {connectError && <span className="text-xs text-danger">{connectError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Connect {connector.name}
          </button>
        ))}
      </div>
      {connectError && <span className="text-xs text-danger">{connectError}</span>}
    </div>
  );
}
