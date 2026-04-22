import { type MailMessage, type MailboxSource } from "../models/types.ts";

export type MailboxAuthMode =
  | "imap_app_password"
  | "imap_authorization_code"
  | "imap_org_password";

export interface MailboxPullCursor {
  uidValidity?: string;
  lastUid?: string;
  pageToken?: string;
}

export interface MailboxAccountConfig {
  source: MailboxSource;
  accountId: string;
  authMode: MailboxAuthMode;
  host: string;
  port: number;
  secure: boolean;
  usernameSecret: string;
  passwordSecret: string;
}

export interface MailboxAdapterPullInput {
  account: MailboxAccountConfig;
  cursor?: MailboxPullCursor;
  limit: number;
}

export interface MailboxAdapterPullResult {
  messages: MailMessage[];
  nextCursor?: MailboxPullCursor;
}

export interface MailboxAdapter {
  readonly source: MailboxSource;
  readonly authMode: MailboxAuthMode;
  pull(input: MailboxAdapterPullInput): Promise<MailboxAdapterPullResult>;
}

export const MAILBOX_ADAPTER_STRATEGIES: Record<
  MailboxSource,
  {
    authMode: MailboxAuthMode;
    host: string;
    port: number;
    secure: boolean;
    incrementalToken: string;
    notes: string;
  }
> = {
  gmail: {
    authMode: "imap_app_password",
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    incrementalToken: "UID",
    notes: "使用 IMAP + App Password，按 UID 做增量拉取。",
  },
  qq: {
    authMode: "imap_authorization_code",
    host: "imap.qq.com",
    port: 993,
    secure: true,
    incrementalToken: "UID",
    notes: "使用 IMAP + 授权码，按 UID 做增量拉取。",
  },
  csu: {
    authMode: "imap_org_password",
    host: "mail.csu.edu.cn",
    port: 993,
    secure: true,
    incrementalToken: "UID",
    notes: "优先按学校 IMAP 帮助页配置，若认证策略变化需以学校说明为准。",
  },
};
