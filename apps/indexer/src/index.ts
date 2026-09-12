import type { Address, PublicClient } from "viem";
import type { ExecutionKernelAddresses } from "@execution-kernel-protocol/sdk";
import type { Bytes32 } from "@execution-kernel-protocol/types";
import { createMemoryStore } from "./db/memoryStore.ts";
import { backfillKernelEvents } from "./processors/kernelEventProcessor.ts";
import { executionsByModule, moduleWinRate, totalExecutions } from "./metrics/executionMetrics.ts";

export * from "./db/memoryStore.ts";
export * from "./listeners/eventListener.ts";
export * from "./processors/kernelEventProcessor.ts";
export * from "./metrics/executionMetrics.ts";

export interface CreateIndexerParams {
  publicClient: PublicClient;
  addresses: ExecutionKernelAddresses;
}

/**
 * Indexer Runtime v1: one long-lived store + cursor, incrementally
 * synchronized, instead of a fresh in-memory store rescanned from block 0
 * on every call (the previous behavior -- see git history for the
 * per-request createIndexer() calls this replaced in apps/api).
 *
 * Constructs an empty store and immediately performs one sync() (the
 * "first synchronization": no cursor yet, so it backfills block 0 through
 * whatever the chain head was at that moment) -- this keeps existing
 * callers that read state immediately after `await createIndexer(...)`
 * (apps/indexer/examples/quickstart.ts, apps/frontend/e2e/full-flow.spec.ts)
 * working unchanged. Callers that hold onto the returned indexer (e.g.
 * apps/api, decorating it once at server startup) should call
 * indexer.sync() again before every subsequent read -- cheap/no-op when
 * nothing new happened, since it only ever fetches (lastProcessedBlock,
 * head], never re-scans from 0 again.
 */
export async function createIndexer(params: CreateIndexerParams) {
  const { publicClient, addresses } = params;
  const store = createMemoryStore();

  // Concurrent callers (e.g. two overlapping HTTP requests) awaiting sync()
  // share one in-flight backfill rather than racing two overlapping ones --
  // both see the same result, and the cursor still only ever advances once
  // per actual chain-head change.
  let inFlightSync: Promise<void> | undefined;

  async function sync(): Promise<void> {
    if (inFlightSync) return inFlightSync;

    inFlightSync = (async () => {
      // cacheTime: 0 -- viem's getBlockNumber() otherwise caches its result
      // for client.cacheTime (defaults to the transport's pollingInterval,
      // 4s for http()), so back-to-back sync() calls could silently read a
      // stale head and wrongly treat real new blocks as "nothing new".
      // Confirmed by hitting exactly this against a live anvil chain before
      // adding this option.
      const head = await publicClient.getBlockNumber({ cacheTime: 0 });
      const cursor = store.getLastProcessedBlock();

      // Subsequent synchronization: nothing new since the last sync.
      if (cursor !== undefined && head <= cursor) return;

      const fromBlock = cursor === undefined ? 0n : cursor + 1n;

      // Cursor safety invariant: setLastProcessedBlock only runs after
      // backfillKernelEvents resolves successfully. If it throws (a bad
      // RPC call, a decode failure, anything), this function rejects,
      // inFlightSync rejects, and lastProcessedBlock is left exactly where
      // it was -- never advanced past a range that wasn't actually
      // processed. Nothing here catches/swallows that rejection.
      await backfillKernelEvents({ publicClient, addresses, store, fromBlock, toBlock: head });

      store.setLastProcessedBlock(head);
    })();

    try {
      await inFlightSync;
    } finally {
      inFlightSync = undefined;
    }
  }

  await sync();

  return {
    store,
    sync,
    totalExecutions: (intentType?: Bytes32) => totalExecutions(store, intentType),
    executionsByModule: (intentType?: Bytes32) => executionsByModule(store, intentType),
    moduleWinRate: (module: Address, intentType: Bytes32) => moduleWinRate(store, module, intentType),
  };
}

export type Indexer = Awaited<ReturnType<typeof createIndexer>>;
