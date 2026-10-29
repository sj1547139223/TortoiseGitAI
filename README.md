# TortoiseGit AI（小乌龟 AI 版本记录）

DeepSeek Harness 插件：AI 每完成一轮修改，自动把**本轮改动**提交到当前分支，提交标题是 AI 写的一句中文概括；查看历史、对比、日志等都直接打开已安装的 TortoiseGit 窗口。

## 工作方式

- **自动提交**：主会话某一轮的第一步开始时，记录仓库基线；这一轮结束（`agent/turn-stopping`）时，如果有改动，就用 `git.exe` 静默提交。
  - 提交标题：`AI: <一句中文概括>`，由当前会话所用模型生成（最多 15 秒，只看脱敏、截断到 8k 的 diff）；失败时退回为 `AI: 修改 <文件…>`。
  - 提交尾注：`AI-Session` / `AI-Turn` / `AI-Model`。插件以这些尾注为准识别 AI 提交，并据此完成撤销。
- **安全边界**：
  - 只处理已启用的仓库：在底部小标签里点"在此仓库启用自动提交"（持久保存），或写进配置 `allowedRoots`。AI 工具不能自己启用仓库。
  - 本轮开始时工作区不干净（包括未跟踪文件），整轮跳过，你自己的修改永远不会被提交。
  - 以下情况也会跳过：分离 HEAD、正在 merge/rebase、本轮期间 HEAD 或暂存区被别人改动、同一仓库还有其他 agent 正在运行。
  - 不执行 reset、stash 或 push，也不跳过 git hooks。
  - 提交范围：只包含本轮期间发生变化的文件（整文件），不是整个文件夹。以下文件永远不会被自动提交：`.gitignore` 里忽略的；内置编译产物清单（`Objects/`、`Listings/`、`DebugConfig/`、`*.o *.obj *.d *.crf *.axf *.elf *.hex *.lst *.map *.lnp *.dep`、`*.uvguix.*`、`*.uvoptx`、`JLinkLog.txt`、`node_modules/`、`build/`、`dist/` 等）；配置 `excludes` 追加的；`.env`/私钥等敏感文件。编译产物的变化也不会让工作区算作"不干净"。
  - 工具链自动识别（启用仓库时和之后每 10 分钟，扫描根目录及两层子目录）：ESP-IDF、PlatformIO、Arduino、Keil、IAR、STM32CubeIDE/Eclipse、CMake、Zephyr、VS Code、Visual Studio/.NET、Qt、Python、Node.js、Rust、Java、KiCad，并追加对应的产物规则（如 `managed_components/`、`.pio/`、`.vscode/ipch/`、`cmake-build-*/`）。
  - AI 判定：本轮新出现、规则未覆盖的文件交给生成标题的同一次模型调用判断；模型判为产物的只从本次提交中剔除，并记成本仓库规则（整个新目录或精确路径）。已跟踪文件的修改永远不会被剔除。面板里可以查看这些规则，点 × 恢复提交。
  - 撤销只用 `git revert`，并且需要确认。
- **界面**：输入框下方状态栏里的小标签（绿点 + 最新提交号；未启用的仓库显示"未启用"，非 git 目录显示"未建仓库"，盘符根目录/用户目录/系统目录不显示）。点开弹出面板：按仓库启用/停用、本会话开关、日志/工作区/版本图（打开 TortoiseGit）、本会话 AI 提交列表（对比、撤销，撤销需二次确认）。
- **一键建仓**：非 git 目录点"一键新建仓库"→ 扫描目录（内置产物规则 + 工具链识别 + 压缩包/临时目录 + 20 MB 以上大文件 + 会话模型给出的忽略建议）→ 列出每条 .gitignore 规则会忽略的文件数和大小，可取消勾选（AI 建议若会忽略源码/文档类文件则默认不勾）→ `git init`、写 .gitignore、初始提交、开启自动提交。已有 .gitignore 只追加缺失行；单个文件超过 100 MB 拒绝；未配置 Git 用户名/邮箱会提示去 TortoiseGit 设置。
- **AI 工具** `tgit_ai`：可执行 `status`、`log`、`diff`、`open`、`pause`、`resume`、`undo`（撤销需传 `confirm:true`，并且只应在用户明确要求时调用）。

## 配置（cordis.patch.yml）

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | true | 全局开关 |
| `allowedRoots` | `[]` | 默认启用的仓库根目录（精确匹配）；界面里的按仓库开关优先 |
| `tgitPath` | 自动查找注册表 | TortoiseGitProc.exe 路径 |
| `summaryTimeoutMs` | 15000 | 生成概括的超时时间 |
| `gitTimeoutMs` | 30000 | 单条 git 命令的超时时间 |
| `excludes` | `[]` | 额外排除的文件，gitignore 写法，如 `['gen/', '*.bin']` |
| `defaultExcludes` | true | 是否使用内置编译产物清单 |

## 限制

- 按仓库启用/停用持久保存；"本会话开关"只在内存中，重启后恢复为开。
- 只对主会话的轮次自动提交；子 agent 的改动会算进父会话那一轮。
- 后台任务如果在这一轮结束后才写文件，这些改动不会算进本轮，并且会让下一轮的基线变脏，导致下一轮跳过。

## 在 Droid 中使用

同一个仓库也是一个 Droid 插件（`.factory-plugin/`、`hooks/hooks.json`、`mcp.json`、`droid/`）。行为与安全边界与 DSH 版一致，`lib/` 共用。

安装（本仓库同时是本地 marketplace）：

```
droid plugin marketplace add H:\TortoiseGitAI
droid plugin install tortoisegit-ai@TortoiseGitAI --scope user
```

安装时插件会被复制到 Droid 的缓存里，所以改完源码要执行 `droid plugin marketplace update TortoiseGitAI` 和 `droid plugin update tortoisegit-ai@TortoiseGitAI --scope user`，然后重启 Droid。hooks 只在 Droid 启动时加载。

启用仓库（只能由你操作，AI 工具不能启用）：在 Droid 输入框里执行 `/tgit-enable`，启用当前目录所在的仓库；也可以写成 `/tgit-enable <路径>`。或者用命令行：

```
node droid/cli.js enable  [仓库路径]   # 默认当前目录
node droid/cli.js disable [仓库路径]
node droid/cli.js status  [仓库路径]   # 查看工具链识别和产物规则
node droid/cli.js forget <规则> [仓库路径]   # 恢复提交被 AI 判为产物的文件
```

与 DSH 版的区别：
- 轮次边界：`UserPromptSubmit` 记录基线，`Stop` 提交，`SessionEnd` 清理。基线保存在 `~/.factory/tortoisegit-ai/sessions/`。
- 提交标题：调用一次 `droid exec`（默认 `claude-haiku-4-5-20251001`，空目录、无可用写工具），大约需要 10 秒；超时或失败就用 `AI: 修改 <文件…>`。`AI-Model` 尾注记录生成标题的模型。
- 用户中断（Esc）的那一轮没有 `Stop` 事件，那一轮不会提交；它留下的改动会让下一轮基线变脏，导致下一轮跳过。
- "同一仓库还有其他 agent" 改为用 `~/.factory/tortoisegit-ai/running/` 下的标记文件判断，2 小时后过期。
- `tgit_ai` 以 MCP 工具形式提供（`tortoisegit-ai___tgit_ai`），会话按"同仓库最近一次 hook 记录的会话"确定。
- 没有底部小标签和面板。

配置文件是 `~/.factory/tortoisegit-ai/config.json`（可选），字段与上表相同，另外有：`summaryModel`、`summaryReasoning`（默认 `off`）、`droidPath`（默认 `droid`）、`summaryTimeoutMs`（默认 25000，最大 60000）。
## 开发

```
npm install
npm test
```
