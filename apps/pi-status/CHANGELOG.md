# @taterdoge/pi-status

## 2.0.1

### Patch Changes

- [`47b5f8b`](https://github.com/TaterDoge/pi-packages/commit/47b5f8b681b6b659d4619943ffdb27ed9dea31d5) Thanks [@TaterDoge](https://github.com/TaterDoge)! - README 补上浏览器拖拽配置页的截图，图片改用 raw 绝对地址，npm 页面上不再缺图。

## 2.0.0

### Major Changes

- [`2795b39`](https://github.com/TaterDoge/pi-packages/commit/2795b39864a3153d043fe952072c104f257b5eb6) Thanks [@TaterDoge](https://github.com/TaterDoge)! - 新增浏览器拖拽配置页 `/pi-status settings`，并把全部设置迁移到该页面；同时移除三个 TUI 子命令。

  - 画布里的两条边框行由扩展自身渲染（复用 `fitBorder` + `renderZoneContent`），所以页面显示的就是终端将画出的样子，包括右侧 zone 被截断的位置。
  - 12 个模块可在四个 zone 之间拖动、在 zone 内排序；拖到 _Turned off_ 即关闭，拖回即启用。
  - 预览固定 120 列：跟随浏览器窗口只换来像素级接近，代价是每次 resize 都要量字体。真实终端仍按自身宽度截断，服务端渲染时同样按该宽度截。
  - 左侧面板编辑分隔符（沿用渲染器的 8 显示单元上限）与 context bar 预设，并提供 Reset defaults 与明暗切换。
  - 保存后立即重装 Editor 并生效，无需重启 session。
  - 页面用一次性 token 换取 `HttpOnly; SameSite=Strict` cookie，只监听 `127.0.0.1`，保存、取消或空闲 10 分钟后自行关闭，静态资源带 CSP。
  - 修正 `components` 字段缺失组件时的行为：`/api/config` 现在拒绝非对象负载，避免把用户布局静默覆盖为默认值。
  - 模块卡片补上图标：每张卡片按模块显示对应 lucide 图标，样例文本改用 Nerd Font 字体栈，不再把 `󰝰`、`` 等私有区字形丢成空白。
  - 修复共享样式表未扫描 `@taterdoge/ui` 组件源码的问题：按钮、卡片等此前丢了一半工具类（`h-8`、`rounded-xl`、`bg-primary` 全未生成），页面样式因此错位。
  - 拖拽现在每次手势只应用一次移动，不再出现模块被复制到目标 zone 的情况。
  - 修好拖拽后的残留：关闭 drop 动画与乐观排序插件，被拖模块不再变灰并固定在原位置、也不再在目标 zone 留下重复卡片。
  - 整卡可拖：不必再瞄准左侧的小图标；按住约 0.25 秒即可拖动，快速拖动仍然是选中文字。
  - 恢复页面文字选中：移除 dnd-kit 注入的全局 `user-select: none`，模块上的文字现在可以正常框选复制。

  **BREAKING：移除 `/pi-status components`、`/pi-status separator`、`/pi-status context-style`。**

  这三条子命令改的是页面上一次拖拽或一个输入框就能完成的事，保留它们等于每次改动模块都要在两处实现、两处修 bug。现在：

  - `/pi-status`（不带参数）直接打开浏览器配置页，`/pi-status settings` 等价。
  - 保留 `/pi-status reset`（写回默认配置）与 `/pi-status help`。
  - 子命令补全同步收窄到 `settings` / `reset` / `help`。
  - 迁移无需操作：三个命令改的都是 `config.json` 里的同一批字段，已有配置文件照旧生效。

### Minor Changes

- [`2795b39`](https://github.com/TaterDoge/pi-packages/commit/2795b39864a3153d043fe952072c104f257b5eb6) Thanks [@TaterDoge](https://github.com/TaterDoge)! - 状态栏每帧不再扫描整个会话，git 轮询减半，并修掉一批静默失效的显示。

  - `tokens` / `cost` 改为在 `message_end` 等事件里算一次存进 `RuntimeState`（新增 `src/session-totals.ts` 单次遍历），渲染函数不再调用 `sessionManager.getEntries()`：此前每次重绘都要全量拷贝并过滤两遍会话条目，流式输出时每帧一次。
  - `readGitStatus` 改用 `git status --porcelain=2 --branch --show-stash`，一次轮询只起一个 git 进程（原来还要额外跑一次 `rev-parse` 探测 stash）。
  - 探测到的 runtime 版本号按运行时缓存，不再每 30 秒 fork 一次 `bun --version` / `node --version`。
  - `runtime` 组件的 `magenta` / `orange` 无效颜色名修正：swift 项目此前实际显示为无颜色的 `via <符号>`；`renderStyle` 也支持「主题色 + bold」共存，不再丢掉主题色。
  - `status` 组件的双重着色去掉（组件自身已按 activity 上色），`renderStyle` 的 ANSI 颜色表提到模块级，不再每次调用新建 Map。
  - `separator` 的 8 格宽度上限真正生效：`validatePiStatusConfig` 会截断超宽分隔符，网页上超宽时 Save 变灰（此前只有红字提示，服务端照存）。
  - 设置页提交的布局必须包含全部模块且不重复，否则返回 400 并列出缺失/重复的 id；此前提交 `{}` 会被默认值补全后落盘，静默重置整份布局。错误里的 `issues` 现在描述的是提交内容，不再是旧配置。
  - 补上 README 已声明但未实现的 `PI_STATUS_DISABLED` 环境变量开关。
  - 删除死代码：`renderFlatLine`、`stripAnsi`、`Segment.slot`、`ConfigPayload.zones/components` 与 `COMPONENT_LABELS`/`ZONE_LABELS`、`CommandContext` 的未用成员、空的 `tool_execution_update` handler、`writePiStatusConfig` 的 `scope` 参数、`moveInLayout` 的 `_from` 参数；`contextLabel` 字符串往返改为 `contextPercent`/`contextWindow` 数值。
  - 测试补到 60 例：porcelain v2 解析、session 汇总、TPS 状态机、渲染零扫描、分隔符截断、布局完整性校验。

### Patch Changes

- [`2795b39`](https://github.com/TaterDoge/pi-packages/commit/2795b39864a3153d043fe952072c104f257b5eb6) Thanks [@TaterDoge](https://github.com/TaterDoge)! - 修复关闭设置网页后 `/pi-status` 命令再也无法执行。

  - 命令 handler 不再 await 网页结果：此前 handler 一直挂着，TUI 的 `session.prompt` 就被阻塞，关掉网页后 `/pi-status`、`/pi-status help`、`/pi-status settings` 全部失效，直到 10 分钟空闲超时。
  - 页面在 `pagehide` 时向 `/api/leave` 发 beacon，服务端在 1.5 秒宽限期后自行关闭并 resolve，关标签页不再需要等空闲超时。
  - 宽限期内任何请求（包括刷新后重新拉取 `/api/config`）都会取消这次关闭，刷新页面不会断开；进入 bfcache 的页面不发 beacon，返回时仍可用。
  - `close()` 追加 `closeAllConnections()`，旧页面的 keep-alive 连接不会让再次执行 `/pi-status` 卡住。

## 1.2.1

### Patch Changes

- [`a1b68fd`](https://github.com/TaterDoge/pi-packages/commit/a1b68fd363cb6cb395b8fc17c7aa627d845babe9) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Stop the git status poll from taking `index.lock`. The poll now runs `git --no-optional-locks status`, so refreshing the index cache no longer blocks a concurrent `git commit`, `git add` or rebase with `fatal: Unable to create '.../index.lock': File exists.` The status output is unchanged.

## 1.2.0

### Minor Changes

- Added configurable context bar style presets
- Moved global config to Pi's extension config directory

## 1.1.0

### Minor Changes

- Added cost component to display session usage fees in the status bar

## 1.0.1

### Patch Changes

- Cleaned up usage statistics quality hints

## 1.0.0

### Initial Release

- Configurable status bar with border decorations around the Editor for Pi
