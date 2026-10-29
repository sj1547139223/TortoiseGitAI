---
description: 为当前仓库（或指定路径）启用 TortoiseGit AI 自动提交
argument-hint: [仓库路径]
---

用户亲自执行了 /tgit-enable，明确要求为仓库启用 TortoiseGit AI 自动提交。

用 Execute 原样运行下面这一条 PowerShell 命令，不要做其他修改。它会找到插件缓存里最新的 `droid/cli.js` 并执行（Droid 不会替斜杠命令展开插件根目录变量）：

```
$cli = Get-ChildItem -Recurse "$HOME/.factory/plugins/cache" -Filter cli.js | Where-Object { $_.Directory.Name -eq 'droid' -and $_.FullName -match 'tortoisegit-ai' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName; node $cli enable $ARGUMENTS
```

没有给出路径时，cli.js 默认启用当前工作目录所在的仓库。运行后用一两句话告诉用户结果：仓库路径、`authorized` 是否为 true、识别出的工具链。
