# 书入

一本跟着你的想法走的小说：你来定方向，AI 来写好，写多久、何时完结都由作者决定。

这是网页版第一版（手机优先），后续会做成 App。产品方案见项目里的《「书入」产品方案》文档。

## 本地运行

```bash
cp .env.example .env      # 填入 APP_SECRET，以及 DEEPSEEK_API_KEY / QWEN_API_KEY（平台额度模式用）
npm install
npm run db:push           # 创建本地 SQLite 数据库
npm run dev               # http://localhost:3000
```

没有模型 Key 也能跑：注册后在“设置”里填自己的 Key 即可写作。

常用命令：`npm test`（单元测试）、`npm run typecheck`、`npm run build`。

## 已实现

| 模块 | 内容 |
| --- | --- |
| 账号 | 邮箱注册登录，会话 Cookie |
| 开书 | 10 个类型场景（含预写第一章），原创设定，“我的人生”问答开书 |
| 写作 | 章末 3 个推荐走向 + 自由输入想法 + “继续让 AI 发挥”，流式输出 |
| 分支 | 重写本章、从任意一章后改写、在分支间切换；每章保存设定集快照，切分支不串设定 |
| 一致性 | 设定集（世界观、主角、人物、事实、文风）每章由 AI 更新，作者可改；较早章节用摘要、最近两章用全文 |
| 完结 | 只由作者发起：下一章完结，或用 3 章收尾；完结后可继续写番外或新卷；AI 不会主动催完结 |
| 付费 | 自带 API Key（DeepSeek、通义千问、豆包、Kimi、智谱，加密存储，保存前验证）；平台额度模式（DeepSeek 主力、通义备用，按 token 记账扣减） |
| 成人向 | 设置中开启，需年龄验证；只放开成熟题材，不含露骨内容 |
| 其他 | 书架、目录、导出 TXT、每章“AI 生成”标识、近 30 天用量 |

## 目录

```
src/lib/llm/        模型厂商配置、选择自带 Key 或平台模型、用量记账
src/lib/story/      提示词、输出解析（标题 / 正文 / META）、章节生成与保存
src/lib/scenes.ts   首批 10 个场景
src/lib/tree.ts     章节分支树
src/app/api/        接口
src/components/     阅读器、开书、设置等页面组件
```

章节生成接口 `POST /api/books/:id/chapters` 返回 NDJSON 流：`delta` 是正文片段，`done` 带新章节信息，`error` 是错误提示。

## 上线前待办

- **实名核验**：现在的年龄验证只校验身份证格式和年龄，需要接入第三方实名核验（姓名 + 证件号一致性，最好加人脸）。
- **内容安全**：`src/lib/moderation.ts` 只是占位，需接入正式内容安全服务，并审核模型输出。
- **生成式 AI 备案**与 ICP 备案。
- **数据库**：生产环境改用 PostgreSQL（修改 `prisma/schema.prisma` 的 provider）。
- **积分充值**：定价确定后接入支付，额度字段 `User.platformTokens` 已按 token 记账。
- **手机号登录**：国内用户更习惯短信验证码登录。
- 第二阶段：广场（分享作品、邀请他人续写）、App。
