/**
 * 基于 cloudflare:sockets TCP 接口实现的轻量 IMAP 客户端。
 * 支持 IMAPS (port 993 TLS)，按 UID 增量拉取，解析 RFC 5322 / MIME 正文。
 */
import { connect } from "cloudflare:sockets";

export interface ImapCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ParsedEmail {
  uid: number;
  messageId: string;
  from: string;
  subject: string;
  date: string;
  /** 纯文本正文，已截断至 MAX_BODY_CHARS */
  body: string;
}

export interface ImapFetchResult {
  emails: ParsedEmail[];
  /** 本次拉取到的最大 UID，用于更新检查点 */
  maxUid: number;
}

const MAX_FETCH_PER_RUN = 5;
const MAX_RAW_BYTES = 512_000; // 跳过超过 500 KB 的邮件正文
const MAX_BODY_CHARS = 3_800;  // Telegram 单条消息上限 4096，留余量给邮件头

export async function fetchNewImapEmails(
  creds: ImapCredentials,
  lastUid: number,
): Promise<ImapFetchResult> {
  const socket = connect(
    { hostname: creds.host, port: creds.port },
    { secureTransport: "on", allowHalfOpen: false },
  );

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const imap = new ImapSession(reader, writer);

  try {
    await imap.readLine(); // 服务器 greeting
    await imap.login(creds.username, creds.password);
    await imap.select();

    const uids = await imap.searchNewUids(lastUid);
    const limited = uids.slice(-MAX_FETCH_PER_RUN);

    const emails: ParsedEmail[] = [];
    let maxUid = lastUid;

    for (const uid of limited) {
      try {
        const raw = await imap.fetchRaw(uid);
        if (raw) {
          emails.push(parseEmail(uid, raw));
          if (uid > maxUid) maxUid = uid;
        }
      } catch {
        // 跳过解析失败的单封邮件，不中断整体流程
      }
    }

    await imap.logout();
    return { emails, maxUid };
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { await socket.close(); } catch { /* ignore */ }
  }
}

// ─── IMAP Session ─────────────────────────────────────────────────────────────

class ImapSession {
  private buf = "";
  private counter = 0;
  private readonly dec = new TextDecoder();
  private readonly enc = new TextEncoder();

  constructor(
    private readonly r: ReadableStreamDefaultReader<Uint8Array>,
    private readonly w: WritableStreamDefaultWriter<Uint8Array>,
  ) {}

  private async refill(): Promise<void> {
    const { done, value } = await this.r.read();
    if (done) throw new Error("IMAP: 连接意外关闭");
    this.buf += this.dec.decode(value, { stream: true });
  }

  async readLine(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf("\r\n");
      if (i !== -1) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        return line;
      }
      await this.refill();
    }
  }

  private async readExact(n: number): Promise<string> {
    while (this.buf.length < n) await this.refill();
    const chunk = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return chunk;
  }

  private async write(data: string): Promise<void> {
    await this.w.write(this.enc.encode(data));
  }

  private tag(): string {
    return `M${String(++this.counter).padStart(3, "0")}`;
  }

  /** 执行命令并收集所有 untagged 响应行，直到收到 tagged OK */
  private async runCmd(cmd: string): Promise<string[]> {
    const t = this.tag();
    await this.write(`${t} ${cmd}\r\n`);
    const lines: string[] = [];
    for (;;) {
      const line = await this.readLine();
      if (line.startsWith(`${t} OK`)) return lines;
      if (line.startsWith(`${t} NO`) || line.startsWith(`${t} BAD`)) {
        throw new Error(`IMAP 命令失败 [${cmd.split(" ")[0]}]: ${line}`);
      }
      // 如果 untagged 行本身携带 literal，消费掉以防缓冲区错位
      const lit = line.match(/\{(\d+)\}$/);
      if (lit) {
        const litContent = await this.readExact(parseInt(lit[1], 10));
        lines.push(line, litContent);
        continue;
      }
      lines.push(line);
    }
  }

  async login(username: string, password: string): Promise<void> {
    await this.runCmd(`LOGIN "${escImap(username)}" "${escImap(password)}"`);
  }

  async select(mailbox = "INBOX"): Promise<void> {
    await this.runCmd(`SELECT ${mailbox}`);
  }

  async searchNewUids(lastUid: number): Promise<number[]> {
    const query = lastUid > 0 ? `UID ${lastUid + 1}:*` : "ALL";
    const lines = await this.runCmd(`UID SEARCH ${query}`);
    for (const line of lines) {
      const m = line.match(/^\* SEARCH\s*(.*)/);
      if (m) {
        return m[1]
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(Number)
          .filter((n) => n > lastUid);
      }
    }
    return [];
  }

  /**
   * 拉取指定 UID 的完整邮件原文。
   * 超过 MAX_RAW_BYTES 的邮件跳过（返回 null）以防内存溢出。
   */
  async fetchRaw(uid: number): Promise<string | null> {
    const t = this.tag();
    await this.write(`${t} UID FETCH ${uid} (BODY.PEEK[])\r\n`);
    let body: string | null = null;
    for (;;) {
      const line = await this.readLine();
      if (line.startsWith(`${t} OK`)) break;
      if (line.startsWith(`${t} NO`) || line.startsWith(`${t} BAD`)) {
        throw new Error(`FETCH 失败 uid=${uid}: ${line}`);
      }
      const lit = line.match(/\{(\d+)\}$/);
      if (lit) {
        const n = parseInt(lit[1], 10);
        if (n > MAX_RAW_BYTES) {
          // 邮件过大，消费掉字节但不保存
          await this.readExact(n);
        } else {
          body = await this.readExact(n);
        }
        await this.readLine(); // 消费 literal 后的 CRLF/括号行
      }
    }
    return body;
  }

  async logout(): Promise<void> {
    const t = this.tag();
    await this.write(`${t} LOGOUT\r\n`).catch(() => { /* ignore */ });
    for (let i = 0; i < 3; i++) {
      try { await this.readLine(); } catch { break; }
    }
  }
}

// ─── RFC 5322 / MIME 解析 ─────────────────────────────────────────────────────

function parseEmail(uid: number, raw: string): ParsedEmail {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sep = text.indexOf("\n\n");
  const hdrStr = sep !== -1 ? text.slice(0, sep) : text;
  const bodyStr = sep !== -1 ? text.slice(sep + 2) : "";

  const hdrs = parseHeaders(hdrStr);
  const ct = hdrs["content-type"] ?? "text/plain";
  const te = hdrs["content-transfer-encoding"] ?? "";
  const charset = getMimeParam(ct, "charset") ?? "utf-8";

  let body: string;
  if (ct.toLowerCase().includes("multipart/")) {
    const boundary = getMimeParam(ct, "boundary") ?? "";
    body = extractMultipartText(bodyStr, boundary);
  } else {
    body = decodeContent(bodyStr, te, charset);
  }

  const trimmed = body.trim();
  const truncated =
    trimmed.length > MAX_BODY_CHARS
      ? trimmed.slice(0, MAX_BODY_CHARS) + "\n…(内容已截断)"
      : trimmed;

  return {
    uid,
    messageId: hdrs["message-id"] ?? `uid-${uid}`,
    from: decodeWords(hdrs["from"] ?? ""),
    subject: decodeWords(hdrs["subject"] ?? "(无主题)"),
    date: hdrs["date"] ?? "",
    body: truncated,
  };
}

function parseHeaders(hdrStr: string): Record<string, string> {
  // 展开折叠头部（RFC 5322 folding: CRLF + 空白）
  const unfolded = hdrStr.replace(/\n([ \t])/g, " ");
  const out: Record<string, string> = {};
  for (const line of unfolded.split("\n")) {
    const c = line.indexOf(":");
    if (c < 1) continue;
    const key = line.slice(0, c).toLowerCase().trim();
    const val = line.slice(c + 1).trim();
    if (!(key in out)) out[key] = val;
  }
  return out;
}

function getMimeParam(header: string, param: string): string | undefined {
  const re = new RegExp(`(?:^|;)\\s*${param}\\s*=\\s*"?([^";\\s]+)"?`, "i");
  return header.match(re)?.[1];
}

function extractMultipartText(body: string, boundary: string): string {
  if (!boundary) return "";
  const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = body.split(new RegExp(`--${esc}(?:--)?\\s*\n?`));
  for (const part of parts) {
    if (!part.trim()) continue;
    const sep = part.indexOf("\n\n");
    if (sep === -1) continue;
    const ph = parseHeaders(part.slice(0, sep));
    const pb = part.slice(sep + 2);
    const pct = ph["content-type"] ?? "text/plain";
    const pte = ph["content-transfer-encoding"] ?? "";
    if (pct.toLowerCase().startsWith("text/plain")) {
      const cs = getMimeParam(pct, "charset") ?? "utf-8";
      return decodeContent(pb, pte, cs);
    }
    if (pct.toLowerCase().includes("multipart/")) {
      const innerBoundary = getMimeParam(pct, "boundary");
      if (innerBoundary) {
        const inner = extractMultipartText(pb, innerBoundary);
        if (inner) return inner;
      }
    }
  }
  return "";
}

function decodeContent(content: string, encoding: string, charset: string): string {
  const e = encoding.toLowerCase().trim();
  try {
    if (e === "base64") {
      const bin = atob(content.replace(/\s/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder(charset).decode(bytes);
    }
    if (e === "quoted-printable") {
      return new TextDecoder(charset).decode(decodeQP(content));
    }
  } catch {
    return content;
  }
  return content;
}

function decodeQP(qp: string): Uint8Array {
  const s = qp.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && i + 2 < s.length) {
      const v = parseInt(s.slice(i + 1, i + 3), 16);
      if (!isNaN(v)) {
        out.push(v);
        i += 2;
        continue;
      }
    }
    out.push(s.charCodeAt(i));
  }
  return new Uint8Array(out);
}

/** 解码 RFC 2047 encoded-words，如 =?UTF-8?B?...?= 或 =?GBK?Q?...?= */
function decodeWords(input: string): string {
  return input.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (original, charset, enc, text) => {
      try {
        let bytes: Uint8Array;
        if (enc.toUpperCase() === "B") {
          const bin = atob(text);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
          bytes = decodeQP(text.replace(/_/g, " "));
        }
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return original;
      }
    },
  );
}

function escImap(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
