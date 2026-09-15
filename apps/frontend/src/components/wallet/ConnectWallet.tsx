"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { ResourceUnavailableRpcError } from "viem";
import { Dot } from "@/components/ui/Badge";

/**
 * Reconnect reliability, not just cosmetics: wagmi's injected() connector
 * calls wallet_revokePermissions on disconnect (real MetaMask MIP-2 support)
 * but only waits up to 100ms locally for it (@wagmi/core's own hardcoded
 * withTimeout) before giving up -- the wallet extension keeps revoking in
 * the background regardless. MetaMask serializes permission-affecting
 * requests per origin, so clicking Connect again inside that window (a very
 * ordinary "disconnect, then immediately reconnect" click) makes the
 * wallet reject the next wallet_requestPermissions call with RPC code
 * -32002 ("already processing"/"already pending") -- which the connector
 * rethrows outright rather than falling back to eth_requestAccounts. The
 * result: the wallet's popup never opens and connect() fails immediately.
 *
 * Confirmed by reproduction (see e2e/_diag-reconnect.spec.ts, not part of
 * the permanent suite): with a mock wallet that models this exact race,
 * the previous code -- which never read useConnect()'s error/isError --
 * failed completely silently, indistinguishable from "nothing happened."
 *
 * The condition is transient (the wallet clears its own queue within a few
 * hundred ms), so retry briefly instead of dead-ending; only a genuine,
 * non-transient failure (user rejection, no provider, etc.) is shown to the
 * user as an actual error.
 */
const RETRY_DELAY_MS = 350;
const MAX_ATTEMPTS = 5;

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

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const [connectError, setConnectError] = useState<string | null>(null);
  // Local state, not wagmi's isPending: isPending only spans a single
  // connectAsync() call, but a retry loop needs the button disabled (and
  // labeled) across the sleep() between attempts too.
  const [busyConnectorUid, setBusyConnectorUid] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

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
          onClick={() => disconnect()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {connectors.map((connector) => {
          const isBusy = busyConnectorUid === connector.uid;
          return (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={busyConnectorUid !== null}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isBusy && retrying ? "Reconnecting..." : `Connect ${connector.name}`}
            </button>
          );
        })}
      </div>
      {connectError && <span className="text-xs text-danger">{connectError}</span>}
    </div>
  );
}
