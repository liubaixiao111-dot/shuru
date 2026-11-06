# 叙事引擎（来自 daha1216/dsh-adult-tension）

`adult-tension/` 是从 https://github.com/daha1216/dsh-adult-tension 的 `skill/adult-tension` 原样复制的（提交 e30bef4）。
该仓库没有开源许可证，这里仅供本人自用，不要公开发布或分发。

书入通过 `src/lib/at/` 调用它：Python 运行时负责状态、时间、随机和校验，书入里的模型扮演原来“宿主模型”的角色。
需要 Python 3.10+（依次尝试 `AT_PYTHON`、`python3`、`python`、`py -3`）。数据目录默认是项目下的 `.at-data/`，可用 `AT_HOME` 修改。
