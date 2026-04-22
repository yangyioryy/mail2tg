# 📬 mail2tg

> 将多路 IMAP 邮箱的新邮件，稳定推送到 Telegram。
> 基于 Cloudflare Workers + D1，无需自建服务器，默认每 5 分钟自动同步一次。

## ✨ 项目简介

`mail2tg` 是一个面向个人场景的邮件通知聚合工具。

当前版本已经实现：

- 同时轮询 `Gmail`、`QQ 邮箱`、`CSU 邮箱`
- 基于 IMAP UID 做增量拉取，避免重复扫描旧邮件
- 基于 D1 去重与投递日志，降低重复推送风险
- 将邮件正文整理后直接发送到 Telegram
- 通过 Cloudflare Cron 定时运行，适合低成本长期托管

这个项目适合以下场景：

- 想把多个邮箱的提醒统一收敛到 Telegram
- 想减少邮件 App 的频繁切换
- 想用一个低维护成本方案做个人消息聚合

## 🚀 核心特性

- **多邮箱并发同步**：三个邮箱源独立执行，单个邮箱异常不会阻塞其它邮箱。
- **增量检查点**：按 IMAP UID 记录同步游标，每次只拉取新增邮件。
- **幂等投递保护**：同一封邮件成功投递后写入去重表，避免重复通知。
- **正文解析能力**：支持 RFC 5322 / MIME，多部分邮件优先提取 `text/plain`，必要时从 `text/html` 降级抽取纯文本。
- **常见编码兼容**：覆盖 `Base64`、`Quoted-Printable` 以及 `UTF-8`、`GBK` 等常见字符集。
- **Telegram 失败分级处理**：`429`、`408`、`5xx` 视为可重试错误；明显不可重试错误会记失败状态，避免无限重放。
- **零服务器运维**：运行在 Cloudflare Workers，持久化使用 D1，部署链路足够轻量。

## 🏗️ 架构概览

```text
IMAP Mailboxes
    │
    ├── Gmail
    ├── QQ Mail
    └── CSU Mail
    │
    ▼
Cloudflare Worker (Cron every 5 min)
    │
    ├── 拉取新 UID
    ├── 解析 MIME 正文
    ├── D1 检查点 / 去重 / 投递日志
    └── Telegram Bot API 推送
    │
    ▼
Telegram Chat / Group / Topic
```

## 🛠️ 技术栈

| 模块 | 技术选型 |
| --- | --- |
| 运行时 | Cloudflare Workers |
| 定时调度 | Cron Triggers |
| 邮件连接 | `cloudflare:sockets` + IMAPS |
| 数据存储 | Cloudflare D1 |
| 推送通道 | Telegram Bot API |
| 开发语言 | TypeScript |
| 测试 | Node.js Test Runner |

## 📦 目录结构

```text
src/
├── adapters/
│   ├── fake.ts
│   ├── imap-client.ts
│   └── types.ts
├── models/
│   └── types.ts
├── services/
│   ├── dedupe.ts
│   ├── sync.ts
│   └── telegram.ts
├── storage/
│   ├── d1-stores.ts
│   └── schema.sql
└── index.ts

scripts/
└── self-check.mjs

test/
├── README.md
└── mail2tg.test.ts
```

## ⚡ 快速开始

### 1. 环境准备

- [Node.js](https://nodejs.org/) 22+
- Cloudflare 账号
- Telegram Bot Token
- 可用的 IMAP 邮箱账号与授权信息

### 2. 克隆仓库

```bash
git clone https://github.com/yangyioryy/mail2tg.git
cd mail2tg
npm install
```

### 3. 创建 D1 数据库

```bash
npx wrangler login
npx wrangler d1 create mail2tg
```

将返回的 `database_id` 写入 `wrangler.jsonc` 的 `d1_databases[0].database_id`。

然后初始化表结构：

```bash
npx wrangler d1 execute mail2tg --remote --file src/storage/schema.sql
```

### 4. 配置 Telegram

先通过 [@BotFather](https://t.me/BotFather) 创建 Bot，然后向 Bot 发送一条消息。

访问：

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

从返回结果中找到目标会话的 `chat.id`，作为 `TELEGRAM_DEFAULT_CHAT_ID`。

### 5. 配置邮箱 IMAP 凭据

| 邮箱 | 用户名 | 密码/授权方式 |
| --- | --- | --- |
| Gmail | 完整邮箱地址 | App Password |
| QQ 邮箱 | 完整邮箱地址 | IMAP 授权码 |
| CSU 邮箱 | 完整邮箱地址 | 邮箱密码或客户端专用密码 |

### 6. 写入 Cloudflare Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_DEFAULT_CHAT_ID
npx wrangler secret put GMAIL_USERNAME_SECRET
npx wrangler secret put GMAIL_PASSWORD_SECRET
npx wrangler secret put QQ_USERNAME_SECRET
npx wrangler secret put QQ_PASSWORD_SECRET
npx wrangler secret put CSU_USERNAME_SECRET
npx wrangler secret put CSU_PASSWORD_SECRET
```

### 7. 部署

```bash
npx wrangler deploy
```

部署完成后：

- 访问 Worker URL 可手动触发一次同步
- 返回 JSON 中会包含每个邮箱的 `fetched` / `sent` 计数
- Cloudflare Cron 会按 `*/5 * * * *` 自动继续执行

## 🔐 环境变量说明

| 变量名 | 用途 | 类型 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | Secret |
| `TELEGRAM_DEFAULT_CHAT_ID` | 默认接收消息的 Chat ID | Secret |
| `GMAIL_USERNAME_SECRET` | Gmail 账号 | Secret |
| `GMAIL_PASSWORD_SECRET` | Gmail App Password | Secret |
| `QQ_USERNAME_SECRET` | QQ 邮箱账号 | Secret |
| `QQ_PASSWORD_SECRET` | QQ 邮箱授权码 | Secret |
| `CSU_USERNAME_SECRET` | CSU 邮箱账号 | Secret |
| `CSU_PASSWORD_SECRET` | CSU 邮箱密码/授权信息 | Secret |
| `MAIL2TG_SUMMARY_LIMIT` | 摘要长度配置项 | Var |
| `MAIL2TG_LOG_LEVEL` | 日志级别 | Var |

## 🧪 本地开发与验证

先复制本地变量模板：

```bash
cp .dev.vars.example .dev.vars
```

然后执行常用命令：

```bash
npm run dev
npm run self-check
npm run typecheck
npm test
```

当前仓库内置了：

- `self-check`：检查关键项目文件是否齐全
- `typecheck`：做 TypeScript 静态类型校验
- `test`：覆盖 Telegram 渲染、去重、同步流程与端到端模拟

## 📨 Telegram 消息示例

```text
<b>[GMAIL] New message subject</b>
📤 发件人：sender@example.com
🕐 时间：Tue, 22 Apr 2026 10:00:00 +0800
🔗 链接：https://mail.example.com/message/1

这里会展示邮件正文的纯文本内容。
如果正文为空，则回退为摘要内容。
```

## 📌 设计取舍

- 为了适配 Telegram 单条消息限制，正文会在安全长度内截断
- 为了降低 Worker 内存压力，超大原始邮件不会被完整保留
- 当前版本聚焦“稳定通知”，不追求完整邮件客户端体验
- 邮箱列表目前在代码中固定定义，后续可抽象为配置化来源

## 🗺️ Roadmap

- 支持更多邮箱源或配置化邮箱列表
- 支持多 Chat / 多 Topic 路由
- 支持人工重同步入口
- 支持更细粒度的摘要与分类策略
- 增加运行日志、告警与可观测性

## 📄 License

MIT
