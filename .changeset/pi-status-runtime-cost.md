---
"@taterdoge/pi-status": minor
---

状态栏每帧不再扫描整个会话，git 轮询减半，并修掉一批静默失效的显示。

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
