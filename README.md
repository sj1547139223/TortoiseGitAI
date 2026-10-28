# TortoiseGit AI（小乌龟 AI 版本记录）

DeepSeek Harness 插件：AI 每完成一轮修改，自动把**本轮改动**提交到当前分支，提交标题是 AI 写的一句中文概括；查看历史、对比、日志等都直接打开已安装的 TortoiseGit 窗口。

## 工作方式

- **自动提交**：主会话某一轮的第一步开始时，记录仓库基线；这一轮结束（`agent/turn-stopping`）时，如果有改动，就用 `git.exe` 静默提交。
  - 提交标题：`AI: <一句中文概括>`，由当前会话所用模型生成（最多 15 秒，只看脱敏、截断到 8k 的 diff）；失败时退回为 `AI: 修改 <文件…>`。
  - 提交尾注：`AI-Session` / `AI-Turn` / `AI-Model`。插件以这些尾注为准识别 AI 提交，并据此完成撤销。
- **安全边界**：
  - 只处理 `allowedRoots` 中明确列出的仓库根目录。
  - 本轮开始时工作区不干净（包括未跟踪文件），整轮跳过，你自己的修改永远不会被提交。
  - 以下情况也会跳过：分离 HEAD、正在 merge/rebase、本轮期间 HEAD 或暂存区被别人改动、同一仓库还有其他 agent 正在运行。
  - 不执行 reset、stash 或 push，也不跳过 git hooks。
  - `.env`、密钥、`node_modules` 等文件不会被提交。
  - 撤销只用 `git revert`，并且需要确认。
- **界面**：输入框下方有一张卡片。
  - 卡片上有自动提交开关和刷新按钮，并显示最近一次结果和本会话的 AI 提交列表。
  - 日志、工作区、版本图、对比按钮会打开 TortoiseGit 窗口。
  - 撤销要经过二次确认。
  - 不在允许范围内的仓库不会显示这张卡片。
- **AI 工具** `tgit_ai`：可执行 `status`、`log`、`diff`、`open`、`pause`、`resume`、`undo`（撤销需传 `confirm:true`，并且只应在用户明确要求时调用）。

## 配置（cordis.patch.yml）

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | true | 全局开关 |
| `allowedRoots` | `[]` | 允许自动提交的仓库根目录（精确匹配） |
| `tgitPath` | 自动查找注册表 | TortoiseGitProc.exe 路径 |
| `summaryTimeoutMs` | 15000 | 生成概括的超时时间 |
| `gitTimeoutMs` | 30000 | 单条 git 命令的超时时间 |

## 限制

- 暂停/开启状态只保存在内存中，重启后恢复为默认值。
- 只对主会话的轮次自动提交；子 agent 的改动会算进父会话那一轮。
- 后台任务如果在这一轮结束后才写文件，这些改动不会算进本轮，并且会让下一轮的基线变脏，导致下一轮跳过。

## 开发

```
npm install
npm test
```
