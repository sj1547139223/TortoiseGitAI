# TortoiseGit AI（小乌龟 AI 版本记录）

DeepSeek Harness 插件（同时提供 Factory Droid 和 Codex 适配）：AI 每完成一轮修改，自动把**本轮改动**提交到当前分支，提交标题是 AI 写的一句中文概括；查看历史、对比、日志等都直接打开已安装的 TortoiseGit 窗口。

主要用途：在 DSH、Factory、Codex 等不同工具之间切换开发时，项目的每一步变更都带着"哪个工具、哪个会话、改了什么"记在 Git 历史里，新接手的工具先读历史就能接上上下文。

## 安装（DSH）

需要 Windows、Git for Windows 和 [TortoiseGit](https://tortoisegit.org/)。在 DSH 里对 AI 说：

```
用 plugin_manager install_bundle 安装 git+https://github.com/sj1547139223/TortoiseGitAI.git
```

或者克隆到本地后安装该目录（`install_bundle` 的 target 写本地绝对路径）。

## 工作方式

- **自动提交**：主会话某一轮的第一步开始时，记录仓库基线；这一轮结束（`agent/turn-stopping`）时，如果有改动，就用 `git.exe` 静默提交。
  - 提交标题：`<工具名>: <一句中文概括>`，工具名为 `DSH` / `Factory` / `Codex`，由当前会话所用模型生成（最多 15 秒，只看脱敏、截断到 8k 的 diff）；失败时退回为 `<工具名>: 修改 <文件…>`。
  - 提交尾注：`AI-Session` / `AI-Turn` / `AI-Model` / `AI-Tool`。插件以这些尾注为准识别 AI 提交，并据此完成撤销。
- **安全边界**：
  - 只处理已启用的仓库：在底部小标签里点"在此仓库启用自动提交"（持久保存），或写进配置 `allowedRoots`。AI 工具不能自己启用仓库。
  - 本轮开始时工作区不干净（包括未跟踪文件），整轮跳过，你自己的修改永远不会被提交。
  - 以下情况也会跳过：分离 HEAD、正在 merge/rebase、本轮期间 HEAD 或暂存区被别人改动、同一仓库还有其他 agent 正在运行。
  - 不执行 reset、stash 或 push，也不跳过 git hooks。
  - 提交范围：只包含本轮期间发生变化的文件（整文件），不是整个文件夹。以下文件永远不会被自动提交：`.gitignore` 里忽略的；内置编译产物清单（`Objects/`、`Listings/`、`DebugConfig/`、`*.o *.obj *.d *.crf *.axf *.elf *.hex *.lst *.map *.lnp *.dep`、`*.uvguix.*`、`*.uvoptx`、`JLinkLog.txt`、`node_modules/`、`build/`、`dist/` 等）；配置 `excludes` 追加的；`.env`/私钥等敏感文件。编译产物的变化也不会让工作区算作"不干净"。
  - 工具链自动识别（启用仓库时和之后每 10 分钟；建仓时在所选文件夹内不限深度，按目录就近生效，已被排除的生成目录里的标记会被忽略）：ESP-IDF、PlatformIO、Arduino、Keil、IAR、STM32CubeIDE/Eclipse、CMake、Zephyr、VS Code、Visual Studio/.NET、Qt、Python、Node.js、Rust、Java、KiCad、Vivado、Vitis（Unified 与 Classic/SDK）、Quartus、ModelSim/Questa，并追加对应的产物规则（如 `managed_components/`、`.pio/`、`.vscode/ipch/`、`cmake-build-*/`）。
  - AI 判定：本轮新出现、规则未覆盖的文件交给生成标题的同一次模型调用判断；模型判为产物的只从本次提交中剔除，并记成本仓库规则（整个新目录或精确路径）。已跟踪文件的修改永远不会被剔除。面板里可以查看这些规则，点 × 恢复提交。
  - 撤销只用 `git revert`，并且需要确认。
- **界面**：输入框下方状态栏里的小标签（绿点 + 最新提交号；未启用的仓库显示"未启用"，非 git 目录显示"未建仓库"，盘符根目录/用户目录/系统目录不显示）。点开弹出面板：按仓库启用/停用、本会话开关、日志/工作区/版本图（打开 TortoiseGit）、本会话 AI 提交列表（对比、撤销，撤销需二次确认）。
- **一键建仓**：非 git 目录（或上次建仓失败留下的没有任何提交的空仓库）点"一键新建仓库"→ 先逐层选择要纳入的文件夹（可对每个文件夹开"自动识别"）→ 只扫描所选文件夹（内置产物规则 + 工具链识别 + 压缩包/临时目录 + 20 MB 以上大文件 + 会话模型给出的忽略建议）→ 列出每条 .gitignore 规则会忽略的文件数和大小，可取消勾选（AI 建议若会忽略源码/文档类文件则默认不勾）→ `git init`、写 .gitignore、初始提交、开启自动提交。插件生成的规则段在重新建仓时整体替换，你自己写的规则保留；建仓失败会自动回滚（删除本次创建的 .git、恢复 .gitignore）；单个文件超过 100 MB 拒绝；未配置 Git 用户名/邮箱会提示去 TortoiseGit 设置。
- **仅代码模式**（建仓默认）：.gitignore 先忽略全部再放行代码类型（`lib/init.js` 的 `CODE_EXTENSIONS`/`CODE_NAMES`：C/C++/汇编/链接脚本、Python/JS 等、构建脚本、Keil/IAR/CubeMX/VS 工程文件、json/yaml/ini/sdkconfig/Kconfig 等代码配置），md/docx/xls/pdf/txt/图片/压缩包都不纳入，以后新建的文档也不会被自动提交。已有仓库可在面板点"仅保留代码文件"：预览后把非代码文件停止跟踪（`git rm --cached`，文件留在磁盘）并写入规则，作为一次提交；要求工作区干净。
- **AI 工具** `tgit_ai`（DSH、Factory、Codex 同一套接口，定义在 `lib/actions.js`）：
  - 读取（随时可用）：`status`、`history`（全项目跨工具历史，可按工具/文件/时间过滤，每条带工具名、会话和改动文件）、`branches`、`log`（本会话）、`diff`。
  - 给用户看：`open` 打开 TortoiseGit 日志/对比/版本图等窗口；`pause` / `resume` 自动提交。
  - 修改（必须 `confirm:true`，只在用户明确要求时调用，且要求工作区干净）：`undo`（revert 本会话的提交）、`branch`（在某版本上建分支，可顺便切换）、`switch`（切换分支或检出某版本）、`restore`（把项目恢复成某版本或某次变更之前，生成新的恢复提交，历史保留）。不提供 reset 等会丢历史的操作。

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

## 在 Codex 中使用

仓库新增 `codex/` 适配器，与 DSH、Factory 共用 `lib/` Git 核心：

- `codex/hook.js` 提供 `start`、`stop`、`end` 回合钩子；提交标题使用 `Codex:` 前缀并写入 `AI-Tool: Codex`。
- `codex/mcp.js` 提供同一套 `tgit_ai` MCP 工具，状态、历史、差异、分支和恢复行为与其他入口一致。
- `codex/cli.js` 提供用户侧 `enable`、`disable`、`status`、`redetect`、`forget` 命令。
- `codex/mcp.json` 是 MCP 配置模板；状态目录默认为 `~/.codex/tortoisegit-ai/`。

启用仓库：

```
node codex/cli.js enable [仓库路径]
```

回合边界调用：

```
node codex/hook.js start
node codex/hook.js stop
node codex/hook.js end
```

提交标题摘要优先调用 `codex exec`，不可用时回退到模板标题。

## 开发

```
npm install
npm test
```

## 许可证

[MIT](LICENSE)
