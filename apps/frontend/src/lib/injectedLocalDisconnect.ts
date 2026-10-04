import { createConnector, injected, type Connector, type CreateConnectorFn } from "wagmi";
import type { InjectedParameters } from "@wagmi/core";

/**
 * Product decision (see the disconnect-lifecycle investigation this
 * replaces): ExeKPro's Disconnect button means "disconnect this wallet from
 * the ExeKPro application session," not "revoke exekpro.com's MetaMask site
 * permission." Those are different actions -- the second is something a
 * user can already do from inside MetaMask itself when they explicitly want
 * it, and doesn't need to be a side effect of an in-app Disconnect click.
 *
 * Verified from the actually-installed @wagmi/core@2.22.1 source (not
 * remembered API surface): `injected()`'s InjectedParameters type is
 * exactly `{ shimDisconnect?, target?, unstable_shimAsyncInject? }` -- there
 * is no parameter, on the connector or on the top-level `disconnect()`
 * action (`DisconnectParameters` is just `{ connector? }`), to opt out of
 * the connector's own `disconnect()` calling `wallet_revokePermissions`. It
 * is unconditional (grep of the entire installed package confirms exactly
 * one call site, in `connectors/injected.js`), wrapped only in a 100ms
 * `withTimeout` (confirmed in viem's own `withTimeout` source: on timeout it
 * simply stops awaiting -- it does not cancel the underlying
 * `provider.request(...)` call, which keeps running against the real
 * extension). That's the actual mechanism this file avoids triggering at
 * all, rather than continuing to race it (PR #31) or poll around it
 * (PR #32) -- both of which left the revoke call itself in place.
 *
 * `createConnector` is @wagmi/core's own public, documented extension point
 * (`injected()` itself is built on it) -- this is a supported composition,
 * not a private-internals hack: build the real, stock injected connector,
 * then return an object identical to it except for `disconnect()`, which
 * performs only the same local bookkeeping the real one does (the
 * shimDisconnect storage flag, so `isAuthorized()` still correctly reports
 * "not authorized" -- including across a page reload, not just this tab --
 * and the `injected.connected` flag for the targetless case) and skips the
 * `wallet_revokePermissions` request entirely. Every other method
 * (`connect`, `getAccounts`, `getChainId`, `getProvider`, `switchChain`,
 * `isAuthorized`, the `onAccountsChanged`/`onChainChanged`/`onConnect`/
 * `onDisconnect` handlers) is the real, unmodified implementation.
 *
 * Traded off deliberately, not overlooked: the real `disconnect()` also
 * removes/re-adds a few raw EIP-1193 provider-level listeners
 * (`chainChanged`/`disconnect`/`connect`) as routine hygiene around the
 * revoke call. Those close over private variables inside `injected.js` that
 * aren't reachable from outside it, so replicating them exactly isn't
 * possible without forking the connector rather than composing it. Leaving
 * them as-is is harmless for correctness here: wagmi's own top-level
 * `disconnect()` action (`@wagmi/core/actions/disconnect.js`) unconditionally
 * unsubscribes this connector's *own* emitter from config's `change`/
 * `disconnect` events right after this method returns, regardless of what
 * this method itself does, and `connect()`'s existing
 * `if (!chainChanged) {...}` guards mean nothing gets double-attached on a
 * later reconnect. The one real, minor, accepted consequence: a manual
 * reconnect performed from *inside* MetaMask's own UI (rather than by
 * clicking Connect in ExeKPro) right after a local disconnect may not be
 * auto-detected the way the stock connector's post-disconnect `'connect'`
 * listener would catch it -- clicking Connect in the app still always
 * works, since `connect()` itself is untouched.
 */
export function injectedLocalDisconnect(parameters: InjectedParameters = {}): CreateConnectorFn {
  const base = injected(parameters);
  return createConnector((config) => {
    const connector = base(config) as ReturnType<typeof base> & Connector;
    return {
      ...connector,
      async disconnect() {
        if (parameters.shimDisconnect !== false) {
          await config.storage?.setItem(`${connector.id}.disconnected`, true);
        }
        if (!parameters.target) {
          await config.storage?.removeItem("injected.connected");
        }
      },
    };
  });
}
