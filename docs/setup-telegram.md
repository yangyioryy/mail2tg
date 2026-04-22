# Telegram 配置说明

## 准备项

- 使用 `@BotFather` 创建 Bot
- 获取 Bot Token
- 获取目标 `chat_id`

## 当前推送约束

Telegram 推送层实现位于 `src/services/telegram.ts`，首版约束如下：

- 统一使用 `sendMessage`
- 默认 `parse_mode=HTML`
- 模板必须包含来源、主题、发件人、时间、摘要
- 有消息链接时追加 `链接` 行
- 默认主题截断到 `80` 字符，摘要截断到 `160` 字符
- 默认最多重试 `3` 次，仅对 `408`、`429` 和 `5xx` 视为可重试

## 多 Chat 扩展位

当前请求体已预留：

- `chat_id`
- `disable_notification`
- `message_thread_id`

这允许后续扩展静音推送、按 Topic 分类推送和多 Chat 分发，而不破坏现有模板。
