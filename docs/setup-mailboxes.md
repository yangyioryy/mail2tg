# 邮箱接入说明

`mail2tg` 的首版邮箱接入层只关注“增量拉取新邮件并标准化”，不处理正文持久化、
附件下载或全文搜索。

## 统一适配器契约

统一接口定义位于 `src/adapters/types.ts`：

- `MailboxAdapter`：统一 `pull()` 契约
- `MailboxAccountConfig`：统一账号与认证配置
- `MailboxPullCursor`：统一增量游标
- `MailboxAdapterPullResult`：统一输出 `MailMessage[]`

这意味着三类邮箱都必须把原始邮件转换为同一套 `MailMessage` 字段后再进入后续
同步、去重和投递链路。

## Gmail

- 认证方式：`IMAP + App Password`
- 服务端：`imap.gmail.com:993`
- 增量策略：按 IMAP `UID` 保存检查点
- 备注：要求账号已开启两步验证，才能生成 App Password

## QQ 邮箱

- 认证方式：`IMAP + 授权码`
- 服务端：`imap.qq.com:993`
- 增量策略：按 IMAP `UID` 保存检查点
- 备注：不能直接使用网页登录密码

## CSU 邮箱

- 认证方式：优先 `IMAP + 学校邮箱密码`
- 服务端：`mail.csu.edu.cn:993`
- 增量策略：按 IMAP `UID` 保存检查点
- 备注：若学校帮助页后续调整 IMAP 或客户端授权方式，以学校官方说明为准

## 统一输出要求

所有适配器输出都必须覆盖以下字段：

- `source`
- `accountId`
- `dedupeKey`
- `remoteMessageId`
- `senderAddress`
- `subject`
- `receivedAt`
- `summary`
- `messageLink`
