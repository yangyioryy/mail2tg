# 首版验收记录

## 本次可复用验收步骤

1. 从空环境拉取仓库
2. 执行 `npm run self-check`
3. 执行 `npm run test`
4. 按 `docs/setup-mailboxes.md`、`docs/setup-telegram.md`、`docs/deploy-cloudflare.md` 配置真实环境
5. 创建 D1、写入 Secrets、部署 Worker、配置 Cron
6. 发送一封测试邮件到目标邮箱
7. 记录邮件到达时间与 Telegram 收到时间
8. 核对 D1 检查点、去重记录和投递日志

## 当前会话已完成的验收证据

- `npm run self-check`：应返回 `self-check ok`
- `npm run test`：当前已通过 `5/5` 测试
- 代码、文档、脚本与 issues CSV 已同步闭环

## 当前会话未验证边界

- 未执行真实 Cloudflare 部署
- 未验证真实 Gmail、QQ、CSU 邮箱拉取
- 未验证真实 Telegram 在线投递
- 未验证分钟级 Cron 到消息投递的端到端时延

## 运维建议

- 初次上线先只接一个测试邮箱，确认去重链路稳定后再扩大范围
- 保留一组独立测试 Chat，避免把调试消息打到正式群
- 每次新增配置项后同时更新 `.dev.vars.example` 和 `docs/deploy-cloudflare.md`
- 每次改动同步逻辑后先执行 `npm run test`

## 后续扩展项

- 邮件正文预览和更细粒度摘要策略
- 多邮箱分类路由与不同 Chat 投递
- 手动重同步入口
- Cloudflare 运行日志与告警集成
