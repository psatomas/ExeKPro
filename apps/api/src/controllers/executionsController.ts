import type { FastifyReply, FastifyRequest } from "fastify";
import type { Bytes32 } from "@execution-kernel-protocol/types";
import { toJsonSafe } from "../utils/json.ts";

const DEFAULT_LIMIT = 20;

/**
 * Raw per-transaction execution records -- previously only aggregate
 * metrics (totalExecutions/executionsByModule) were exposed, even though
 * apps/indexer's store already holds the individual records
 * (blockNumber/transactionHash/user/selectedModule/result) this just reads
 * back out. Most-recent-first, capped at `limit` (default 20) so this
 * can't return an unbounded response as history grows.
 *
 * Reads the one shared indexer decorated onto the server in
 * apps/api/src/index.ts (built from this process's actual configured
 * deployment, not a hardcoded one) instead of constructing a fresh one --
 * sync() incrementally catches up before every read, it never rescans
 * from block 0 here.
 */
export async function listExecutions(
  request: FastifyRequest<{ Querystring: { intentType?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  await request.server.indexer.sync();

  const intentType = request.query.intentType as Bytes32 | undefined;
  const limit = Math.min(Number(request.query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 100);

  const all = request.server.indexer.store.getExecutions();
  const filtered = intentType ? all.filter((e) => e.intentType === intentType) : all;
  const recent = filtered.slice(-limit).reverse();

  return reply.send(toJsonSafe({ executions: recent }));
}
