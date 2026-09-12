import type { Address } from "viem";
import type { Bytes32, Hex } from "@execution-kernel-protocol/types";

export interface IntentExecutionRecord {
  blockNumber: bigint;
  transactionHash: Hex;
  user: Address;
  intentType: Bytes32;
  selectedModule: Address;
  result: Hex;
}

export interface ModuleRegistrationRecord {
  blockNumber: bigint;
  intentType: Bytes32;
  module: Address;
  active: boolean;
}

export interface IntentRegistrationRecord {
  blockNumber: bigint;
  intentType: Bytes32;
  name?: string;
  active: boolean;
}

export interface WeightsUpdateRecord {
  blockNumber: bigint;
  qualityWeight: bigint;
  costWeight: bigint;
  mevWeight: bigint;
  latencyWeight: bigint;
}

export interface OwnershipTransferRecord {
  blockNumber: bigint;
  previousOwner: Address;
  newOwner: Address;
}

/**
 * The smallest store contract Indexer Runtime v1 actually needs: the
 * execution-record read/write path plus the sync cursor. Deliberately not
 * every method MemoryStore has -- module/intent registration, weights, and
 * ownership records have no consumer outside this package's own
 * examples/quickstart.ts smoke script (confirmed by inspection before this
 * change), so they stay on the concrete MemoryStore type below rather than
 * being pulled into this abstraction speculatively. Any backend (this one,
 * or a future persistent one) that wants to serve indexer.sync() and the
 * execution-facing API routes only needs to satisfy this.
 *
 * `lastProcessedBlock` is undefined until the first successful sync --
 * see index.ts's sync() for exactly when/how it advances. It means "the
 * highest block whose relevant events have been successfully processed",
 * never "the next block to process".
 */
export interface IndexerStore {
  recordExecution(record: IntentExecutionRecord): void;
  getExecutions(): readonly IntentExecutionRecord[];
  getLastProcessedBlock(): bigint | undefined;
  setLastProcessedBlock(block: bigint): void;
}

/**
 * In-memory store: enough to prove the indexing pipeline end to end without
 * committing to a real database dependency (SQLite/Postgres/etc.) before
 * there's a concrete need for one. Swap this for a real backend behind the
 * same interface once persistence across restarts actually matters.
 */
export function createMemoryStore() {
  const executions: IntentExecutionRecord[] = [];
  const moduleRegistrations: ModuleRegistrationRecord[] = [];
  const intentRegistrations: IntentRegistrationRecord[] = [];
  const weightsUpdates: WeightsUpdateRecord[] = [];
  const ownershipTransfers: OwnershipTransferRecord[] = [];
  let lastProcessedBlock: bigint | undefined;

  return {
    recordExecution(record: IntentExecutionRecord): void {
      executions.push(record);
    },
    recordModuleRegistration(record: ModuleRegistrationRecord): void {
      moduleRegistrations.push(record);
    },
    recordIntentRegistration(record: IntentRegistrationRecord): void {
      intentRegistrations.push(record);
    },
    recordWeightsUpdate(record: WeightsUpdateRecord): void {
      weightsUpdates.push(record);
    },
    recordOwnershipTransfer(record: OwnershipTransferRecord): void {
      ownershipTransfers.push(record);
    },

    getExecutions(): readonly IntentExecutionRecord[] {
      return executions;
    },
    getModuleRegistrations(): readonly ModuleRegistrationRecord[] {
      return moduleRegistrations;
    },
    getIntentRegistrations(): readonly IntentRegistrationRecord[] {
      return intentRegistrations;
    },
    getWeightsUpdates(): readonly WeightsUpdateRecord[] {
      return weightsUpdates;
    },
    getOwnershipTransfers(): readonly OwnershipTransferRecord[] {
      return ownershipTransfers;
    },

    getLastProcessedBlock(): bigint | undefined {
      return lastProcessedBlock;
    },
    setLastProcessedBlock(block: bigint): void {
      lastProcessedBlock = block;
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
