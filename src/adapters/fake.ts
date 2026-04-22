import { type MailMessage, type MailboxSource } from "../models/types.ts";
import {
  type MailboxAdapter,
  type MailboxAdapterPullInput,
  type MailboxAdapterPullResult,
} from "./types.ts";

export class FakeMailboxAdapter implements MailboxAdapter {
  readonly source: MailboxSource;
  readonly authMode = "imap_app_password" as const;
  readonly seededMessages: MailMessage[];

  constructor(source: MailboxSource, seededMessages: MailMessage[]) {
    this.source = source;
    this.seededMessages = seededMessages;
  }

  async pull(input: MailboxAdapterPullInput): Promise<MailboxAdapterPullResult> {
    return {
      messages: this.seededMessages.slice(0, input.limit),
      nextCursor: {
        lastUid: `cursor-${this.seededMessages.length}`,
      },
    };
  }
}
