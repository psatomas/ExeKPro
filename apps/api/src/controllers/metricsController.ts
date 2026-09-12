import type { FastifyReply, FastifyRequest } from "fastify";
import type { Address } from "viem";
import type { Bytes32 } from "@execution-kernel-protocol/types";
import { toJsonSafe } from "../utils/json.ts";

/**
 * Reads the one shared indexer decorated onto the server in
 * apps/api/src/index.ts -- built from this process's actual configured
 * deployment (not a hardcoded localAnvilAddresses), and synchronized
 * incrementally here rather than rescanned from block 0 on every request.
 */
export async function getExecutionMetrics(
  request: FastifyRequest<{ Querystring: { intentType?: string } }>,
  reply: FastifyReply,
) {
  await request.server.indexer.sync();
  const intentType = request.query.intentType as Bytes32 | undefined;

  return reply.send(
    toJsonSafe({
      totalExecutions: request.server.indexer.totalExecutions(intentType),
      executionsByModule: request.server.indexer.executionsByModule(intentType),
    }),
  );
}

export async function getModuleWinRate(
  request: FastifyRequest<{ Params: { intentType: string; module: string } }>,
  reply: FastifyReply,
) {
  await request.server.indexer.sync();
  const intentType = request.params.intentType as Bytes32;
  const module = request.params.module as Address;

  return reply.send(toJsonSafe({ winRate: request.server.indexer.moduleWinRate(module, intentType) }));
}
