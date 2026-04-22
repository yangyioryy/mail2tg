import { type MailMessage } from "../models/types.ts";

export interface DedupeStore {
  has(dedupeKey: string): Promise<boolean>;
  remember(dedupeKey: string): Promise<void>;
}

export interface DedupeDecision {
  message: MailMessage;
  duplicate: boolean;
}

export async function filterNewMessages(
  store: DedupeStore,
  messages: MailMessage[],
): Promise<DedupeDecision[]> {
  const decisions: DedupeDecision[] = [];

  for (const message of messages) {
    const duplicate = await store.has(message.dedupeKey);

    if (!duplicate) {
      await store.remember(message.dedupeKey);
    }

    decisions.push({
      message,
      duplicate,
    });
  }

  return decisions;
}
