---
"@taterdoge/pi-status": major
---

新增浏览器拖拽配置页 `/pi-status settings`，并把全部设置迁移到该页面；同时移除三个 TUI 子命令。

- 画布里的两条边框行由扩展自身渲染（复用 `fitBorder` + `renderZoneContent`），所以页面显示的就是终端将画出的样子，包括右侧 zone 被截断的位置。
- 12 个模块可在四个 zone 之间拖动、在 zone 内排序；拖到 *Turned off* 即关闭，拖回即启用。
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
