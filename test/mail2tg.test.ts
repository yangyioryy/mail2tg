import test from "node:test";
import assert from "node:assert/strict";

import { FakeMailboxAdapter } from "../src/adapters/fake.ts";
import { filterNewMessages, type DedupeStore } from "../src/services/dedupe.ts";
import { runSync, type SyncCheckpointStore } from "../src/services/sync.ts";
import {
  buildTelegramRequestBody,
  isRetryableTelegramStatus,
  renderTelegramMessage,
} from "../src/services/telegram.ts";
import type { MailMessage } from "../src/models/types.ts";

class InMemoryDedupeStore implements DedupeStore {
  keys = new Set<string>();

  async has(dedupeKey: string): Promise<boolean> {
    return this.keys.has(dedupeKey);
  }

  async remember(dedupeKey: string): Promise<void> {
    this.keys.add(dedupeKey);
  }
}

class InMemoryCheckpointStore implements SyncCheckpointStore {
  values = new Map<string, string>();
  resetCalls = 0;

  async load(source: string, accountId: string): Promise<string | undefined> {
    return this.values.get(`${source}:${accountId}`);
  }

  async save(source: string, accountId: string, cursor: string): Promise<void> {
    this.values.set(`${source}:${accountId}`, cursor);
  }

  async reset(source: string, accountId: string): Promise<void> {
    this.resetCalls += 1;
    this.values.delete(`${source}:${accountId}`);
  }
}

function buildMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    source: "gmail",
    accountId: "demo-account",
    dedupeKey: "gmail:demo-account:1",
    remoteMessageId: "remote-1",
    senderAddress: "alice@example.com",
    subject: "A very long subject line for telegram rendering",
    receivedAt: "2026-04-22T20:00:00+08:00",
    summary: "summary content that should be rendered into telegram",
    messageLink: "https://mail.example.com/message/1",
    ...overrides,
  };
}

test("renderTelegramMessage 包含关键字段并做截断/转义", () => {
  const output = renderTelegramMessage(
    buildMessage({
      subject: "<unsafe subject>",
      summary: "x".repeat(200),
    }),
    {
      maxSubjectLength: 10,
      maxSummaryLength: 20,
      maxAttempts: 3,
    },
  );

  assert.match(output, /\[GMAIL\]/);
  assert.match(output, /发件人：alice@example.com/);
  assert.match(output, /时间：2026-04-22T20:00:00\+08:00/);
  assert.match(output, /摘要：x{19}…/);
  assert.match(output, /链接：https:\/\/mail\.example\.com\/message\/1/);
  assert.match(output, /&lt;unsafe s…/);
});

test("filterNewMessages 会拦截重复 dedupeKey", async () => {
  const store = new InMemoryDedupeStore();
  const message = buildMessage();

  const first = await filterNewMessages(store, [message]);
  const second = await filterNewMessages(store, [message]);

  assert.equal(first[0]?.duplicate, false);
  assert.equal(second[0]?.duplicate, true);
});

test("runSync 支持 manual_resync 且不会绕过去重保护", async () => {
  const checkpointStore = new InMemoryCheckpointStore();
  const dedupeStore = new InMemoryDedupeStore();
  const seededMessages = [buildMessage()];

  const first = await runSync(checkpointStore, dedupeStore, {
    source: "gmail",
    accountId: "demo-account",
    mode: "incremental",
    async pull() {
      return {
        cursor: "cursor-1",
        messages: seededMessages,
      };
    },
  });

  const second = await runSync(checkpointStore, dedupeStore, {
    source: "gmail",
    accountId: "demo-account",
    mode: "manual_resync",
    async pull() {
      return {
        cursor: "cursor-2",
        messages: seededMessages,
      };
    },
  });

  assert.equal(first.deliverableCount, 1);
  assert.equal(second.deliverableCount, 0);
  assert.equal(checkpointStore.resetCalls, 1);
  assert.equal(checkpointStore.values.get("gmail:demo-account"), "cursor-2");
});

test("Telegram 状态分类只重试限流和服务端错误", () => {
  assert.equal(isRetryableTelegramStatus(429), true);
  assert.equal(isRetryableTelegramStatus(500), true);
  assert.equal(isRetryableTelegramStatus(400), false);
});

test("端到端模拟：假适配器 -> 同步 -> Telegram 请求构造", async () => {
  const adapter = new FakeMailboxAdapter("gmail", [buildMessage()]);
  const pullResult = await adapter.pull({
    account: {
      source: "gmail",
      accountId: "demo-account",
      authMode: "imap_app_password",
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      usernameSecret: "demo-user",
      passwordSecret: "demo-pass",
    },
    limit: 10,
  });

  const syncResult = await runSync(
    new InMemoryCheckpointStore(),
    new InMemoryDedupeStore(),
    {
      source: "gmail",
      accountId: "demo-account",
      mode: "incremental",
      async pull() {
        return {
          cursor: pullResult.nextCursor?.lastUid,
          messages: pullResult.messages,
        };
      },
    },
  );

  const requestBody = buildTelegramRequestBody(
    pullResult.messages[0]!,
    {
      chatId: "123456",
    },
    {
      maxSubjectLength: 80,
      maxSummaryLength: 160,
      maxAttempts: 3,
    },
  );

  assert.equal(syncResult.deliverableCount, 1);
  assert.equal(requestBody.chat_id, "123456");
  assert.match(String(requestBody.text), /\[GMAIL\]/);
});
