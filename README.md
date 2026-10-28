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
- **界面**：输入框下方状态栏里的小标签（绿点 + 最新提交号；未启用的仓库显示"未启用"，非 git 目录不显示）。点开弹出面板：按仓库启用/停用、本会话开关、日志/工作区/版本图（打开 TortoiseGit）、本会话 AI 提交列表（对比、撤销，撤销需二次确认）。
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

## 开发

```
npm install
npm test
```
