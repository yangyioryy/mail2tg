# mail2tg

`mail2tg` 是一个部署在 Cloudflare 上的分钟级邮件通知聚合器。首版目标是把
Gmail、QQ 邮箱和 CSU 邮箱的新邮件通知统一标准化后推送到 Telegram，而不是
实现一个完整的邮件客户端。

## MVP 边界

首版包含以下能力：

- 统一抽象 Gmail、QQ 邮箱和 CSU 邮箱的新邮件输入
- 标准化输出邮箱来源、发件人、主题、时间、摘要、消息链接和去重键
- 使用检查点执行增量同步，避免重复拉取
- 使用 Telegram Bot 发送统一格式的通知
- 使用 Cloudflare Worker、Cron Triggers 和 D1 组成部署闭环

首版明确不包含以下能力：

- 邮件正文持久化
- 附件下载、存储与转发
- 完整 HTML 渲染与内联图片处理
- 全文搜索和历史归档浏览
- 面向用户的 Web 管理后台

## 统一模型

当前统一模型定义位于 `src/models/types.ts`，约束首版各层共享同一套核心结构：

- `MailMessage`：邮件标准化模型
- `SyncCheckpoint`：同步状态模型
- `DeliveryRecord`：投递状态模型
- `Mail2tgError`：错误模型
- `MVP_SCOPE`：首版包含项与排除项

后续适配器、持久层、模板层和测试层都应复用这些定义，不允许私自扩展未评审
字段。

## 首版交付物

- Cloudflare Worker 项目代码
- D1 schema 与初始化脚本
- 示例环境变量与 Secrets 说明
- Gmail、QQ 邮箱、CSU 邮箱接入说明
- Telegram 配置说明
- Cloudflare 部署与排障文档
