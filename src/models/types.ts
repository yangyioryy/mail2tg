export type MailboxSource = "gmail" | "qq" | "csu";

export interface MailMessage {
  source: MailboxSource;
  accountId: string;
  dedupeKey: string;
  remoteMessageId: string;
  senderName?: string;
  senderAddress: string;
  subject: string;
  receivedAt: string;
  summary: string;
  messageLink?: string;
}

export type SyncRunStatus = "idle" | "running" | "succeeded" | "failed";

export interface SyncCheckpoint {
  source: MailboxSource;
  accountId: string;
  cursor: string;
  lastSyncedAt: string;
  status: SyncRunStatus;
}

export type DeliveryStatus = "pending" | "sent" | "skipped" | "failed";

export interface DeliveryRecord {
  dedupeKey: string;
  telegramChatId: string;
  status: DeliveryStatus;
  deliveredAt?: string;
  errorCode?: Mail2tgErrorCode;
}

export type Mail2tgErrorCode =
  | "config.invalid"
  | "adapter.auth_failed"
  | "adapter.fetch_failed"
  | "sync.checkpoint_conflict"
  | "delivery.rate_limited"
  | "delivery.remote_failed";

export interface Mail2tgError {
  code: Mail2tgErrorCode;
  message: string;
  retryable: boolean;
  source?: MailboxSource;
  cause?: string;
}

export const MVP_INCLUDED_CAPABILITIES = [
  "分钟级新邮件通知聚合",
  "统一消息标准化字段",
  "基于去重键的幂等投递",
  "基于检查点的增量同步",
  "Cloudflare Worker + Cron + D1 部署",
] as const;

export const MVP_EXCLUDED_CAPABILITIES = [
  "邮件正文持久化",
  "附件下载与转发",
  "完整 HTML 渲染",
  "全文检索",
  "历史邮件批量归档",
] as const;

export interface DeliveryScope {
  included: readonly string[];
  excluded: readonly string[];
}

export const MVP_SCOPE: DeliveryScope = {
  included: MVP_INCLUDED_CAPABILITIES,
  excluded: MVP_EXCLUDED_CAPABILITIES,
};
