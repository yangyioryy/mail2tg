import type { MailboxSource } from "../models/types.ts";
import type { SyncCheckpointStore } from "../services/sync.ts";
import type { DedupeStore } from "../services/dedupe.ts";

export class D1CheckpointStore implements SyncCheckpointStore {
  constructor(private readonly db: D1Database) {}

  async load(source: MailboxSource, accountId: string): Promise<string | undefined> {
    const row = await this.db
      .prepare("SELECT cursor FROM sync_checkpoints WHERE source = ? AND account_id = ?")
      .bind(source, accountId)
      .first<{ cursor: string }>();
    return row?.cursor;
  }

  async save(source: MailboxSource, accountId: string, cursor: string): Promise<void> {
    await this.db
      .prepare(
        "INSERT OR REPLACE INTO sync_checkpoints (source, account_id, cursor, last_synced_at) VALUES (?, ?, ?, ?)",
      )
      .bind(source, accountId, cursor, new Date().toISOString())
      .run();
  }

  async reset(source: MailboxSource, accountId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM sync_checkpoints WHERE source = ? AND account_id = ?")
      .bind(source, accountId)
      .run();
  }
}

export class D1DedupeStore implements DedupeStore {
  constructor(
    private readonly db: D1Database,
    private readonly source: MailboxSource,
    private readonly accountId: string,
  ) {}

  async has(dedupeKey: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM message_dedupe WHERE dedupe_key = ?")
      .bind(dedupeKey)
      .first();
    return row !== null;
  }

  async remember(dedupeKey: string): Promise<void> {
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO message_dedupe (dedupe_key, source, account_id, first_seen_at) VALUES (?, ?, ?, ?)",
      )
      .bind(dedupeKey, this.source, this.accountId, new Date().toISOString())
      .run();
  }
}

export async function logDelivery(
  db: D1Database,
  dedupeKey: string,
  chatId: string,
  status: "sent" | "failed",
  errorCode?: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT OR REPLACE INTO delivery_logs (dedupe_key, telegram_chat_id, status, error_code, delivered_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(dedupeKey, chatId, status, errorCode ?? null, new Date().toISOString())
    .run();
}
