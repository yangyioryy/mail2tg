import { fetchNewImapEmails } from "./adapters/imap-client.ts";
import { D1CheckpointStore, D1DedupeStore, logDelivery } from "./storage/d1-stores.ts";
import { sendTelegramNotification } from "./services/telegram.ts";
import type { MailboxSource, MailMessage } from "./models/types.ts";

// ─── 环境变量类型定义 ──────────────────────────────────────────────────────────

export interface Env {
  MAIL2TG_DB: D1Database;

  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_DEFAULT_CHAT_ID: string;

  GMAIL_USERNAME_SECRET: string;
  GMAIL_PASSWORD_SECRET: string;

  QQ_USERNAME_SECRET: string;
  QQ_PASSWORD_SECRET: string;

  CSU_USERNAME_SECRET: string;
  CSU_PASSWORD_SECRET: string;

  MAIL2TG_SUMMARY_LIMIT: string;
  MAIL2TG_LOG_LEVEL: string;
}

// ─── 邮箱配置表（硬编码三个目标邮箱）─────────────────────────────────────────

interface MailboxDef {
  source: MailboxSource;
  accountId: string;
  host: string;
  port: number;
  getCredentials(env: Env): { username: string; password: string };
}

const MAILBOXES: MailboxDef[] = [
  {
    source: "gmail",
    accountId: "gmail-primary",
    host: "imap.gmail.com",
    port: 993,
    getCredentials: (env) => ({
      username: env.GMAIL_USERNAME_SECRET,
      password: env.GMAIL_PASSWORD_SECRET,
    }),
  },
  {
    source: "qq",
    accountId: "qq-primary",
    host: "imap.qq.com",
    port: 993,
    getCredentials: (env) => ({
      username: env.QQ_USERNAME_SECRET,
      password: env.QQ_PASSWORD_SECRET,
    }),
  },
  {
    source: "csu",
    accountId: "csu-primary",
    host: "mail.csu.edu.cn",
    port: 993,
    getCredentials: (env) => ({
      username: env.CSU_USERNAME_SECRET,
      password: env.CSU_PASSWORD_SECRET,
    }),
  },
];

// ─── Worker 入口 ────────────────────────────────────────────────────────────

export default {
  /** HTTP 触发：用于手动测试，返回本次同步摘要 */
  async fetch(_request: Request, env: Env): Promise<Response> {
    const results = await syncAll(env);
    return Response.json({ ok: true, results });
  },

  /** Cron 触发：每 5 分钟自动执行 */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await syncAll(env);
  },
};

// ─── 核心编排 ──────────────────────────────────────────────────────────────

interface SyncSummary {
  source: MailboxSource;
  fetched?: number;
  sent?: number;
  error?: string;
}

async function syncAll(env: Env): Promise<SyncSummary[]> {
  const checkpointStore = new D1CheckpointStore(env.MAIL2TG_DB);

  // 三个邮箱并发执行，互不阻塞
  const settled = await Promise.allSettled(
    MAILBOXES.map((mb) => syncMailbox(env, checkpointStore, mb)),
  );

  return settled.map((result, i) => {
    const source = MAILBOXES[i]!.source;
    if (result.status === "fulfilled") {
      return { source, ...result.value };
    }
    return { source, error: String(result.reason) };
  });
}

async function syncMailbox(
  env: Env,
  checkpointStore: D1CheckpointStore,
  mb: MailboxDef,
): Promise<{ fetched: number; sent: number }> {
  const creds = mb.getCredentials(env);

  // 加载上次拉取的最大 UID 作为检查点
  const lastCursor = await checkpointStore.load(mb.source, mb.accountId);
  const lastUid = lastCursor ? parseInt(lastCursor, 10) : 0;

  // IMAP 拉取新邮件
  const { emails, maxUid } = await fetchNewImapEmails(
    { host: mb.host, port: mb.port, ...creds },
    lastUid,
  );

  const dedupeStore = new D1DedupeStore(env.MAIL2TG_DB, mb.source, mb.accountId);
  let sent = 0;

  for (const email of emails) {
    const dedupeKey = `${mb.source}:${email.uid}`;

    // 幂等检查：已投递过的跳过
    if (await dedupeStore.has(dedupeKey)) continue;

    const message: MailMessage = {
      source: mb.source,
      accountId: mb.accountId,
      dedupeKey,
      remoteMessageId: email.messageId,
      senderAddress: email.from,
      subject: email.subject,
      receivedAt: email.date,
      summary: email.body.slice(0, 160),
      body: email.body,
    };

    const result = await sendTelegramNotification({
      token: env.TELEGRAM_BOT_TOKEN,
      target: { chatId: env.TELEGRAM_DEFAULT_CHAT_ID },
      message,
    });

    if (result.ok) {
      await dedupeStore.remember(dedupeKey);
      await logDelivery(env.MAIL2TG_DB, dedupeKey, env.TELEGRAM_DEFAULT_CHAT_ID, "sent");
      sent++;
    } else if (!result.retryable) {
      // 非可重试错误（如 400 Bad Request）：标记已处理，避免无限重试
      await dedupeStore.remember(dedupeKey);
      await logDelivery(
        env.MAIL2TG_DB,
        dedupeKey,
        env.TELEGRAM_DEFAULT_CHAT_ID,
        "failed",
        `http_${result.status}`,
      );
    }
    // 可重试错误（429/5xx）：不标记，下次 Cron 会重试
  }

  // 仅在有新邮件时更新检查点
  if (maxUid > lastUid) {
    await checkpointStore.save(mb.source, mb.accountId, String(maxUid));
  }

  return { fetched: emails.length, sent };
}
