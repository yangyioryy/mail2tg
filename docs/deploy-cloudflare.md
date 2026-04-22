# Cloudflare 部署说明

## 配置分层

`mail2tg` 的配置分为两类：

- Cloudflare Secrets：存放敏感信息
- 普通环境变量：存放非敏感运行参数

## Secrets

以下字段必须通过 `wrangler secret put` 或 Cloudflare Dashboard 配置：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID`
- `GMAIL_USERNAME_SECRET`
- `GMAIL_PASSWORD_SECRET`
- `QQ_USERNAME_SECRET`
- `QQ_PASSWORD_SECRET`
- `CSU_USERNAME_SECRET`
- `CSU_PASSWORD_SECRET`

## 普通环境变量

以下字段可保存在 `wrangler.jsonc` 或 `.dev.vars.example`：

- `MAIL2TG_SUMMARY_LIMIT`
- `MAIL2TG_LOG_LEVEL`

## 当前配置表

| 变量名 | 敏感性 | 说明 | 建议存放位置 |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | 敏感 | Telegram Bot Token | Secret |
| `TELEGRAM_DEFAULT_CHAT_ID` | 敏感 | 默认推送 Chat ID | Secret |
| `GMAIL_USERNAME_SECRET` | 敏感 | Gmail 登录账号 | Secret |
| `GMAIL_PASSWORD_SECRET` | 敏感 | Gmail App Password | Secret |
| `QQ_USERNAME_SECRET` | 敏感 | QQ 邮箱账号 | Secret |
| `QQ_PASSWORD_SECRET` | 敏感 | QQ 邮箱授权码 | Secret |
| `CSU_USERNAME_SECRET` | 敏感 | CSU 邮箱账号 | Secret |
| `CSU_PASSWORD_SECRET` | 敏感 | CSU 邮箱密码或授权信息 | Secret |
| `MAIL2TG_SUMMARY_LIMIT` | 非敏感 | 摘要最大长度 | Var |
| `MAIL2TG_LOG_LEVEL` | 非敏感 | 日志级别 | Var |

## 最小部署步骤

1. 创建 D1 数据库并把 `database_id` 写入 `wrangler.jsonc`
2. 配置 `triggers.crons`
3. 写入全部 Secrets
4. 使用 `.dev.vars.example` 衍生本地调试变量
5. 执行 `wrangler deploy`
