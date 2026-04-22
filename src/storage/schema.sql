CREATE TABLE IF NOT EXISTS mailbox_configs (
  source TEXT NOT NULL,
  account_id TEXT NOT NULL,
  secret_name TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (source, account_id)
);

CREATE TABLE IF NOT EXISTS sync_checkpoints (
  source TEXT NOT NULL,
  account_id TEXT NOT NULL,
  cursor TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  PRIMARY KEY (source, account_id)
);

CREATE TABLE IF NOT EXISTS message_dedupe (
  dedupe_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  account_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_logs (
  dedupe_key TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  delivered_at TEXT NOT NULL,
  PRIMARY KEY (dedupe_key, telegram_chat_id)
);
