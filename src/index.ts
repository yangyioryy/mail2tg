import { type MailMessage, type MailboxSource } from "./models/types";

export interface Env {
  MAIL2TG_DB: D1Database;
  MAIL2TG_SUMMARY_LIMIT: string;
  MAIL2TG_LOG_LEVEL: string;
}

export interface ExecutionContextShape {
  trigger: "fetch" | "scheduled";
  mailboxSources: MailboxSource[];
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const summary = await buildExecutionSummary(env, {
      trigger: "fetch",
      mailboxSources: ["gmail", "qq", "csu"],
    });

    return Response.json(summary);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await buildExecutionSummary(env, {
      trigger: "scheduled",
      mailboxSources: ["gmail", "qq", "csu"],
    });
  },
};

// Worker 负责调度与编排，不直接持久化正文，也不在入口层处理 Telegram 模板细节。
async function buildExecutionSummary(
  env: Env,
  context: ExecutionContextShape,
): Promise<Record<string, unknown>> {
  const mailboxConfigs = await loadMailboxConfigs(env);
  const checkpoints = await loadCheckpoints(env, context.mailboxSources);
  const normalizedMessages = normalizeMailboxMessages();

  return {
    trigger: context.trigger,
    mailboxConfigCount: mailboxConfigs.length,
    checkpointSources: checkpoints.map((checkpoint) => checkpoint.source),
    stages: [
      "load mailbox configs",
      "load checkpoints",
      "pull mailbox messages",
      "normalize messages",
      "dedupe with D1",
      "deliver to Telegram",
      "persist delivery logs",
    ],
    normalizedMessageCount: normalizedMessages.length,
  };
}

async function loadMailboxConfigs(_env: Env): Promise<Array<{ source: MailboxSource }>> {
  return [{ source: "gmail" }, { source: "qq" }, { source: "csu" }];
}

async function loadCheckpoints(
  _env: Env,
  sources: MailboxSource[],
): Promise<Array<{ source: MailboxSource }>> {
  return sources.map((source) => ({ source }));
}

function normalizeMailboxMessages(): MailMessage[] {
  return [];
}
