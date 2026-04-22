# 排障说明

## 常见问题

### 1. Telegram 没有收到消息

- 检查 `TELEGRAM_BOT_TOKEN` 是否有效
- 检查 `TELEGRAM_DEFAULT_CHAT_ID` 是否正确
- 检查 Bot 是否已加入目标 Chat 或 Topic
- 检查 `src/services/telegram.ts` 中是否把状态判为可重试

### 2. 出现重复通知

- 检查 `message_dedupe` 表是否正常写入
- 检查 `dedupeKey` 是否稳定
- 检查是否绕过了 `runSync()` 的去重链路

### 3. 邮箱拉取失败

- Gmail：确认已开启两步验证并生成 App Password
- QQ：确认已开启 IMAP 并使用授权码
- CSU：确认学校邮箱仍允许 IMAP 客户端接入
- 检查邮箱游标是否推进错误，导致重复拉取或漏拉取

### 4. Cloudflare 部署后不触发

- 检查 `wrangler.jsonc` 中的 `triggers.crons`
- 检查 D1 `database_id` 是否已替换
- 检查 Secrets 是否在目标环境中写入

## 建议排查顺序

1. `npm run self-check`
2. `npm run test`
3. 核对 `.dev.vars.example` 和 `docs/deploy-cloudflare.md`
4. 核对 Telegram、邮箱与 D1 的配置项
5. 最后再看运行时日志

## 已知限制

- 当前自动化测试覆盖的是纯逻辑和模拟链路，不等于真实邮箱联调
- 当前 Worker 入口仍是骨架，后续接入真实适配器时还需要补运行态验证
- 当前首版目标是分钟级通知，不承诺秒级实时性
