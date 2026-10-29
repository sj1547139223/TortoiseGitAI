---
description: 为当前仓库（或指定路径）启用 TortoiseGit AI 自动提交
argument-hint: [仓库路径]
---

用户亲自执行了 /tgit-enable，明确要求为仓库启用 TortoiseGit AI 自动提交。

运行这一条命令（Execute），不要做其他修改：

```
node "${DROID_PLUGIN_ROOT}/droid/cli.js" enable $ARGUMENTS
```

- 如果 `${DROID_PLUGIN_ROOT}` 没有被展开成实际路径，就在 `~/.factory/plugins/cache/` 下找到 tortoisegit-ai 最新的目录，用其中的 `droid/cli.js`。
- 没有给出路径时，cli.js 默认启用当前工作目录所在的仓库。
- 运行后用一两句话告诉用户结果：仓库路径、`authorized` 是否为 true、识别出的工具链。
