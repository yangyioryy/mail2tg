import { type MailMessage } from "../models/types.ts";

export interface TelegramTarget {
  chatId: string;
  disableNotification?: boolean;
  topicId?: string;
}

export interface TelegramDeliveryPolicy {
  maxSubjectLength: number;
  maxSummaryLength: number;
  maxAttempts: number;
}

export interface TelegramSendInput {
  token: string;
  target: TelegramTarget;
  message: MailMessage;
  policy?: Partial<TelegramDeliveryPolicy>;
}

export interface TelegramSendResult {
  ok: boolean;
  status: number;
  retryable: boolean;
  requestBody: Record<string, unknown>;
}

export const DEFAULT_TELEGRAM_POLICY: TelegramDeliveryPolicy = {
  maxSubjectLength: 80,
  maxSummaryLength: 160,
  maxAttempts: 3,
};

export async function sendTelegramNotification(
  input: TelegramSendInput,
  fetcher: typeof fetch = fetch,
): Promise<TelegramSendResult> {
  const policy = { ...DEFAULT_TELEGRAM_POLICY, ...input.policy };
  const requestBody = buildTelegramRequestBody(input.message, input.target, policy);
  const response = await fetcher(buildTelegramApiUrl(input.token), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  return {
    ok: response.ok,
    status: response.status,
    retryable: isRetryableTelegramStatus(response.status),
    requestBody,
  };
}

export function buildTelegramRequestBody(
  message: MailMessage,
  target: TelegramTarget,
  policy: TelegramDeliveryPolicy,
): Record<string, unknown> {
  return {
    chat_id: target.chatId,
    disable_notification: target.disableNotification ?? false,
    message_thread_id: target.topicId,
    parse_mode: "HTML",
    text: renderTelegramMessage(message, policy),
  };
}

export function renderTelegramMessage(
  message: MailMessage,
  policy: TelegramDeliveryPolicy = DEFAULT_TELEGRAM_POLICY,
): string {
  const subject = truncateText(message.subject, policy.maxSubjectLength);
  const summary = truncateText(message.summary, policy.maxSummaryLength);
  const sourceLabel = message.source.toUpperCase();

  const lines = [
    `<b>[${escapeHtml(sourceLabel)}]</b> ${escapeHtml(subject)}`,
    `发件人：${escapeHtml(message.senderAddress)}`,
    `时间：${escapeHtml(message.receivedAt)}`,
    `摘要：${escapeHtml(summary)}`,
  ];

  if (message.messageLink) {
    lines.push(`链接：${escapeHtml(message.messageLink)}`);
  }

  return lines.join("\n");
}

export function isRetryableTelegramStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function buildTelegramApiUrl(token: string): string {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
