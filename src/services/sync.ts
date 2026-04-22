import { type MailMessage, type MailboxSource } from "../models/types";
import { filterNewMessages, type DedupeStore } from "./dedupe";

export type SyncMode = "initial_backfill" | "incremental" | "resume" | "manual_resync";

export interface SyncCheckpointStore {
  load(source: MailboxSource, accountId: string): Promise<string | undefined>;
  save(source: MailboxSource, accountId: string, cursor: string): Promise<void>;
  reset(source: MailboxSource, accountId: string): Promise<void>;
}

export interface SyncRunInput {
  source: MailboxSource;
  accountId: string;
  mode: SyncMode;
  pull(cursor?: string): Promise<{ cursor?: string; messages: MailMessage[] }>;
}

export interface SyncRunResult {
  mode: SyncMode;
  fetchedCount: number;
  deliverableCount: number;
  nextCursor?: string;
}

export async function runSync(
  checkpointStore: SyncCheckpointStore,
  dedupeStore: DedupeStore,
  input: SyncRunInput,
): Promise<SyncRunResult> {
  const existingCursor =
    input.mode === "manual_resync"
      ? await resetCheckpoint(checkpointStore, input.source, input.accountId)
      : await checkpointStore.load(input.source, input.accountId);

  const pullResult = await input.pull(existingCursor);
  const decisions = await filterNewMessages(dedupeStore, pullResult.messages);

  if (pullResult.cursor) {
    // 只有在本轮去重与投递阶段完成后才推进检查点，避免跳过未投递消息。
    await checkpointStore.save(input.source, input.accountId, pullResult.cursor);
  }

  return {
    mode: input.mode,
    fetchedCount: pullResult.messages.length,
    deliverableCount: decisions.filter((item) => !item.duplicate).length,
    nextCursor: pullResult.cursor,
  };
}

async function resetCheckpoint(
  checkpointStore: SyncCheckpointStore,
  source: MailboxSource,
  accountId: string,
): Promise<undefined> {
  await checkpointStore.reset(source, accountId);
  return undefined;
}
