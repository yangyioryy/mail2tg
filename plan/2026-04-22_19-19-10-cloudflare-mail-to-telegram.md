---
mode: plan
cwd: C:\Users\huawei\Desktop\mail2tg
task: 规划并实现一个部署在 Cloudflare 上的 mail2tg 项目，将 Gmail、QQ 邮箱和中南大学邮箱的新邮件通知转发到 Telegram，并补齐完整配置与部署教程
complexity: complex
planning_method: builtin
created_at: 2026-04-22T19:19:10+08:00
---

# Plan: Cloudflare Mail To Telegram

🎯 任务概述

目标是构建一个无需自有服务器的邮件通知聚合器，将 Gmail、QQ 邮箱和
`8209230623@csu.edu.cn` 的新邮件通知统一转发到 Telegram。项目最终
不仅要能在 Cloudflare 上稳定部署，还必须附带一套从邮箱配置、Telegram
配置到 Cloudflare 部署的完整教程。

边界上，第一阶段优先实现“新邮件通知”而不是“完整邮件客户端”。默认只
同步必要字段，例如邮箱来源、发件人、主题、时间、摘要、消息链接与去重
信息，暂不承诺附件搬运、完整 HTML 渲染和全文搜索。

📋 执行计划

1. 明确 MVP 边界和统一输入输出
   - 定义三类邮箱统一后的消息模型、状态模型、错误模型。
   - 明确首版只做通知聚合，不做正文持久化和附件下载。
   - 定义最终交付物：可运行代码、部署配置、示例环境变量、完整教程。

2. 设计 Cloudflare 侧运行架构
   - 采用 `Worker + Cron Triggers + D1` 的基础组合。
   - Worker 负责定时拉取、标准化、去重和转发。
   - D1 存储邮箱配置、同步检查点、消息幂等键和投递日志。

3. 设计邮箱接入层
   - Gmail 优先采用 IMAP + App Password。
   - QQ 邮箱采用 IMAP + 授权码。
   - 中南大学邮箱优先采用学校提供的 IMAP 客户端配置。
   - 抽象统一适配器接口，避免三套流程各写一遍。

4. 设计 Telegram 推送层
   - 封装 Bot API 调用与错误处理。
   - 统一通知模板，支持来源标记、主题截断、摘要降噪和失败重试。
   - 预留按邮箱分类推送、静音开关和多 Chat 扩展位。

5. 规划同步与幂等机制
   - 基于邮箱 UID 或等价增量标识维护检查点。
   - D1 中记录 `message_dedupe`，避免重复发送。
   - 为首次全量、断点续拉、错误恢复和人工重同步预留接口。

6. 规划配置与密钥管理
   - 将邮箱账号、密码或授权码、Telegram Bot Token、Chat ID 放入
     Cloudflare Secrets。
   - 将非敏感配置，例如轮询窗口、摘要长度、日志级别放在环境变量中。
   - 输出 `.dev.vars.example` 或等价示例文件，降低部署门槛。

7. 规划项目结构与基础工程
   - 建立 `src/`、`docs/`、`plan/`、`test/` 等基础目录。
   - 约定模块边界：邮箱适配器、调度入口、持久层、消息模板、配置层。
   - 补齐基础脚本，例如本地调试、D1 初始化和简单自检。

8. 规划测试与验证闭环
   - 为消息模板、去重逻辑、状态推进逻辑编写单元测试。
   - 为邮箱适配器编写可替换的假实现，避免测试依赖真实邮箱。
   - 部署前至少完成一次“模拟输入 -> D1 写入 -> Telegram 请求构造”
     的端到端验证。

9. 输出文档与教程
   - 编写 `README.md`，说明项目目标、架构、快速开始和限制。
   - 编写邮箱配置教程，分别覆盖 Gmail、QQ 邮箱和 CSU 邮箱。
   - 编写 Telegram 配置教程，说明 Bot 创建、Token 获取和 Chat ID 获取。
   - 编写 Cloudflare 部署教程，说明 Worker、D1、Secrets、Cron、日志和
     更新流程。
   - 编写排障文档，覆盖鉴权失败、重复通知、拉取失败、消息过长等问题。

10. 完成交付验收
    - 按教程从零配置一遍，验证文档可操作。
    - 用至少一个测试邮箱验证新邮件能稳定推送到 Telegram。
    - 整理首版限制、后续扩展项和运维建议。

⚠️ 风险与注意事项

- Gmail 个人账号要先开启两步验证，才能生成 App Password。
- QQ 邮箱必须先开启 IMAP/SMTP，并使用授权码而不是网页登录密码。
- 学校邮箱的客户端协议和认证方式可能受学校侧策略限制，需要以实际帮助页
  和登录结果为准。
- Cloudflare Cron 不是严格实时；首版目标应定义为“分钟级通知”而非秒级。
- 若后续要求转发完整正文、内联图片或附件，复杂度和免费额度压力都会上升。
- 真实邮箱凭据不能写入仓库；必须通过 Cloudflare Secrets 管理。

📦 首版交付物

- `src/` 下的 Worker 项目代码
- D1 schema 与初始化脚本
- 示例配置文件
- `README.md`
- `docs/setup-mailboxes.md`
- `docs/setup-telegram.md`
- `docs/deploy-cloudflare.md`
- `docs/troubleshooting.md`

🗂️ 建议目录结构

```text
mail2tg/
├── plan/
├── docs/
│   ├── setup-mailboxes.md
│   ├── setup-telegram.md
│   ├── deploy-cloudflare.md
│   └── troubleshooting.md
├── src/
│   ├── index.ts
│   ├── config/
│   ├── adapters/
│   │   ├── gmail.ts
│   │   ├── qq.ts
│   │   └── csu.ts
│   ├── services/
│   │   ├── sync.ts
│   │   ├── dedupe.ts
│   │   └── telegram.ts
│   ├── storage/
│   │   ├── d1.ts
│   │   └── schema.sql
│   └── utils/
├── test/
├── package.json
├── wrangler.jsonc
└── README.md
```

🚀 实施路线图

- Milestone 1: 初始化 Worker 工程和 D1 schema，跑通本地开发与部署框架。
- Milestone 2: 接入 Telegram Bot，先验证固定消息可投递。
- Milestone 3: 完成单邮箱增量同步链路，优先打通 Gmail。
- Milestone 4: 补齐 QQ 邮箱和 CSU 邮箱适配器，统一错误处理。
- Milestone 5: 补齐教程文档，并按文档完成一次完整部署验收。

📎 参考

- `AGENTS.md:1`
- Cloudflare Workers TCP sockets: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Gmail IMAP and App Password docs:
  https://support.google.com/mail/answer/7126229?hl=en
- Gmail App Password docs:
  https://support.google.com/mail/answer/185833
- CSU 邮箱帮助页: https://mail.csu.edu.cn/coremail/help/index_zh_CN_old.jsp
- 腾讯 QQ 邮箱接入说明:
  https://hiflow.tencent.com/docs/applications/qq-mail/
- Telegram Bot API: https://core.telegram.org/bots/api
