# 致谢与来源（CREDITS）

书入使用了下面这些外部项目的内容。逐一列出出处、使用范围、对应许可证，以及我们做了哪些改动。

## 1. Adult Tension 叙事引擎（Skill）

| 项 | 内容 |
| --- | --- |
| 名称 | Adult Tension（`adult-tension` Skill） |
| 作者 | [daha1216](https://github.com/daha1216) |
| 来源仓库 | https://github.com/daha1216/dsh-adult-tension |
| 使用的版本 | 仓库中的 `skill/adult-tension` 目录，提交 [`e30bef4`](https://github.com/daha1216/dsh-adult-tension/commit/e30bef40688d5da1cd8d9afecf98c4ec21385bfb)，Skill 版本 0.3.0 |
| 上游许可证 | 双许可（见上游 [LICENSE](https://github.com/daha1216/dsh-adult-tension/blob/main/LICENSE)）：代码与工程配置为 [MIT License](https://opensource.org/licenses/MIT)；叙事素材与文档（世界框架、素材池、文案模板、各文档）为 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans) |

**在书入里的位置**

| 路径 | 内容 | 适用许可（按上游说明） |
| --- | --- | --- |
| `engine/adult-tension/runtime/`、`engine/adult-tension/scripts/` | Python 运行时（状态、时间、随机、校验），原样复制 | MIT（代码） |
| `engine/adult-tension/SKILL.md`、`references/`、`agents/` | Skill 说明与叙事规则，原样复制 | CC BY-NC 4.0（文档） |
| `engine/adult-tension/content/`（含 211 个世界） | 世界框架与素材池，原样复制 | CC BY-NC 4.0（叙事素材） |
| `src/lib/at/prompts.ts` | 运行时读取 `SKILL.md` 与 `references/` 原文，去掉命令行相关章节，加上书入的宿主说明后作为系统提示词 | 拼进去的上游原文仍为 CC BY-NC 4.0 |
| `docs/host-prompts/record-system.md`、`write-system.md` | 上面拼好的两份系统提示词（“先记录”和“写正文”两步）的导出样本，绝大部分是上游原文 | CC BY-NC 4.0 |

**书入做的改动**

- 引擎目录原样复制，没有修改上游文件。
- 书入用 TypeScript 做“宿主”（`src/lib/at/`）：程序代替原 Skill 里的宿主模型调用运行时，模型每回合先提交记录、再按运行时结果写正文。
- 提示词层面：去掉了“调用运行时”“第一次”“命令与别名”“参考资料”几节，在前面加了书入的宿主说明，并加入每回合篇幅可选等书入自己的要求。
- 上游的最高规则（所有角色均为明示成年人、遵守玩家硬边界与“暂停”）原样保留。

**使用条件（重要）**

- 再分发时必须保留署名和上述许可证链接，并说明做过的改动（本文件即为此用途）。
- CC BY-NC 4.0 部分**不得用于商业目的**。书入里的“积分充值 / 平台额度”等收费功能如果要和这部分引擎、世界素材、规则一起使用，需要先取得上游作者的单独授权，或换成自己原创的素材与规则。
- 本仓库复制的是 `e30bef4` 时的文件，上游许可以上游仓库当前的 LICENSE 为准；如有出入，以上游为准。

## 2. 第三方依赖

npm 依赖（Next.js、React、Prisma、Tailwind CSS、Vitest、Electron 等）各自使用其自己的开源许可证，完整清单见 `package.json` 与 `package-lock.json`，安装后可在 `node_modules/<包名>/LICENSE` 查看。

## 3. 模型服务

书入通过各厂商的 OpenAI 兼容接口调用模型：DeepSeek、通义千问（阿里云百炼）、豆包（火山方舟）、Kimi（月之暗面）、智谱 GLM。仓库里只有接口地址，不包含任何密钥；使用时须遵守各家的服务条款。

## 4. 书入自己的内容

除上面列出的部分外，书入的网页代码（`src/`、`electron/`、`prisma/`、`tests/` 等）以及 `src/lib/scenes.ts` 里的 8 个原创场景由书入项目自行编写。
