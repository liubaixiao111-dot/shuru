# 叙事引擎（来自 daha1216/dsh-adult-tension）

`adult-tension/` 是从 https://github.com/daha1216/dsh-adult-tension 的 `skill/adult-tension` 原样复制的（提交 `e30bef4`，Skill 0.3.0），作者 [daha1216](https://github.com/daha1216)。

**许可**：上游为双许可。代码与工程配置（运行时 Python 脚本）为 MIT License；叙事素材与文档（`SKILL.md`、`references/`、`content/` 世界与素材池）为 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans)，须署名、**不得商用**。详见上游 LICENSE 和本仓库根目录的 [CREDITS.md](../CREDITS.md)。

书入通过 `src/lib/at/` 调用它：Python 运行时负责状态、时间、随机和校验，书入里的模型扮演原来“宿主模型”的角色。
需要 Python 3.10+（依次尝试 `AT_PYTHON`、`python3`、`python`、`py -3`）。数据目录默认是项目下的 `.at-data/`，可用 `AT_HOME` 修改。
