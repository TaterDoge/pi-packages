# `pi-status` 浏览器拖拽配置页 实施计划

> 仓库：`/Users/taterdoge/Project/pi-packages`
>
> 目标包：`apps/pi-status`
>
> 对齐参考：`apps/pi-image-generate`（浏览器设置页现有实现）、`docs/browser-ui-architecture.md`（共享边界）

## Context

`pi-status` 现在的配置入口只有 TUI 菜单（`/pi-status components`，上下键 + 左右键在 4 个 zone 间搬移）。12 个模块分 4 个 zone 的排版，用方向键调顺序是可行但不直观的。

目标：`/pi-status settings` 打开一个本地网页，用**拖拽画布**直观地排版状态栏边框，并能保存。

具体要求：

- 画布要显示**当前配置真实渲染出来的边框效果**，不是示意图。
- 12 个固定模块可以在画布上的编辑框（4 个 zone）之间拖动组合，形成新的展示顺序。
- 保存后立刻在终端生效，**不用重启 session**。

## 需求翻译成数据模型

必须先钉死这一点，否则会滑向“自由画布”。

现状（`src/render.ts:collectZoneSegments`）：渲染顺序 = `config.components` 数组顺序，按 `zone` 分桶后依次拼接。所以：

| 用户语言 | 真实模型 |
| --- | --- |
| 画布上自由摆位置 | ❌ 终端是字符网格，只有 4 个固定挂点 |
| 拖到聊天框里组合顺序 | ✅ 4 条**有序列表**，跨列表搬移 + 列表内排序 |
| 显示边框效果 | ✅ 复用 `renderZoneContent` + `fitBorder` 出真 ANSI |

禁止的做法：给 `ComponentConfig` 加 `x` / `y` / `order` 之类字段。`fitBorder` 只有 left/right 两端，任何中间坐标都无处渲染。

新增状态只有一处需要定义语义：**不在任何 zone 里的模块 = 关闭**。因为 `validatePiStatusConfig` 会给缺失的组件补默认值（`src/config.ts:44`），所以“禁用”必须表示为 `enabled: false` 且保留在数组里，不能从数组删除。

## Architecture

### 数据流

```text
/pi-status settings
  └─ startSettingsServer({ 读 config, 渲染回调, 写 config })
       ├─ 浏览器 GET  /api/config        → { config, labels, zones, styles, meta }
       ├─ 浏览器 POST /api/preview       → { top, bottom, width }   (ANSI 两行)
       └─ 浏览器 POST /api/config        → 校验 → 写盘 → 关闭 server 并生效
```

只有 3 个端点。**不引入 descriptor / SettingsField DSL**——`docs/browser-ui-architecture.md` 第 2 节明确否决过，且 `pi-status` 正是当初举的反例（“12 个固定组件拖进 4 个 zone + 实时预览”）。

### 服务端

复制 `apps/pi-image-generate/src/settings/server.ts` 的骨架（约 200 行），按需裁剪：

| image-generate 有 | pi-status 需要 | 理由 |
| --- | --- | --- |
| token → HttpOnly cookie | ✅ 保留 | 防同机其他页面读取配置 |
| 只监听 `127.0.0.1` | ✅ 保留 | |
| 空闲 10 分钟自关 | ✅ 保留 | |
| 静态资源 CSP + nosniff | ✅ 保留 | |
| `secrets` + `maskPaths` / `restoreMasked` | ❌ 删除 | pi-status 配置里没有密钥 |
| `descriptor` 泛型 + `validate` 回调 | ❌ 删除 | 直接用现成的 `validatePiStatusConfig` |
| `/api/action` | ❌ 删除 | 没有远端探测类操作 |
| `/api/delete-record` | ❌ 删除 | 模块列表固定，不可增删 |

边界脚本（`scripts/check-extension-boundaries.mjs`）禁止 extension→extension 依赖，所以**只能复制，不能 import**。这是文档里已经接受过的成本。

### 预览渲染：复用 TUI 渲染器，服务端出 ANSI

新增 `src/settings/preview.ts`（约 50 行）：

```ts
renderPreview(config: PiStatusConfig, width: number, theme, state, ctx) → { top: string, bottom: string }
```

- 直接调用 `renderZoneContent()`（同 `src/editor.ts:PiStatusEditor.render` 的路径）
- 边框走 `fitBorder(left, right, width - 2, (t) => theme.fg("borderMuted", t))`——与 `PiStatusEditor` 的 `borderColor` 一致
- 宽度参数由前端滑块控制（60–200，默认 `process.stdout.columns ?? 120`）

**为什么不在前端用 TSX 重画 12 个组件**：两套渲染逻辑必然漂移，`fitBorder` 的右先截断规则、`renderStyle` 的 ANSI/主题色回退、`context.ts` 的进度条色阶都会对不上。复用 = 预览和终端逐字节同源。

代价：浏览器要解析 ANSI。`renderStyle` 产出的是 16 色 SGR（`\x1b[1;36m`），`theme.fg` 产出的是 truecolor（`\x1b[38;2;r;g;bm`）。前端写一个约 40 行的 SGR → `<span>` 转换器，支持：

- `0` / `39` 重置
- `1` 粗体、`2` 暗色
- `30–37` / `90–97` 前景 16 色（映射到 CSS 变量）
- `38;2;r;g;b` 真彩

**已知保真度缺口**：16 色由终端调色板决定，浏览器只能用近似值（写死一套 xterm 风格调色板）。Nerd Font 图标（``、`◐`、`◼`）在浏览器 fallback 字体下可能差半格，导致右侧对齐全宽偏差一格。

如果这个偏差不可接受，升级方案（备选 B）：`/api/preview` 改为返回结构化 `{ leftText, rightText, fillWidth }`，前端用 flex 画边框，宽度由 CSS 控制，完全不受字体影响。缺点是丢掉了 segment 内部的 ANSI 五彩效果，需要额外传 segment 列表。

先做 A，验收时对比截图；偏差明显再切 B。

### 拖拽：`@dnd-kit/react`（锁定精确版本）

| 候选 | 结论 |
| --- | --- |
| `@dnd-kit/react@0.5.1` + `@dnd-kit/helpers@0.5.1` | ✅ 选用。2026 重写版，peer 支持 React 19；`group` + `move()` 原生支持跨容器 + 组内排序，`onDragEnd` 约 15 行 |
| `@dnd-kit/core@6.3` + `@dnd-kit/sortable@10` | 备选。稳定多年、文档多，但跨列表要手写 `onDragOver` 搬数组（约 40 行） |
| `@atlaskit/pragmatic-drag-and-drop@4` | 最稳，但接入代码最多，本场景过度 |
| 原生 HTML5 DnD | 无触摸、无键盘、`dragenter` 冒泡要自己扛；不符合 shadcn/a11y 基线 |
| react-flow / Konva | ❌ 自由坐标模型，与 4 zone 冲突 |

`package.json` 里写死 `"@dnd-kit/react": "0.5.1"`（不带 `^`）——0.x 版本 0.4→0.5 改过事件类型，不允许自动升级。若实施期发现 0.5.1 与 Bun workspace 有兼容问题，降级为 core+sortable 组合，UI 层不变。

shadcn registry 没有官方 drag 件；第三方（ReUI Sortable、Shadix Reorder）都是 `@dnd-kit/sortable` 的二次封装，跨 4 容器插入用不上，直接依赖底座。

键盘无障碍由 `KeyboardSensor` 免费获得（方向键移动 + 空格确认）。

### 页面结构

```text
┌──────────────────────────────────────────────────────────────┐
│ pi-status — Status bar layout                    [浅/深] [×] │
├────────────────────┬─────────────────────────────────────────┤
│ 未启用（托盘）      │  ╭─ idle · proj · turn 1 ──── $0.012 ─╮ │
│  ┌──────┐          │  │                                     │ │
│  │ git  │          │  │        [ editor placeholder ]       │ │
│  └──────┘          │  │                                     │ │
│  ┌────────────┐    │  ╰─ model · hi ───────── ↑12k ↓3k ────╯ │
│  │ current_tool│   │                                         │
│  └────────────┘    │  渲染宽度  [────────●────] 120           │
│                    │  分隔符    [ ·      ]                   │
│                    │  进度条    [Blocks ▾]  ▸ 实时预览        │
├────────────────────┴─────────────────────────────────────────┤
│ 写入：~/.pi/agent/extensions/pi-status/config.json           │
│                          [重置默认]  [取消]  [保存并应用]      │
└──────────────────────────────────────────────────────────────┘
```

交互规则：

- 顶部 `╭...╮` / 底部 `╰...╯` 两行 = 2 个 droppable 区域，各自左右两半 = 4 个 zone 列表。
- 卡片从 zone 拖到左侧托盘 = `enabled: false`；从托盘拖回任意 zone = `enabled: true`。
- 卡片必须同时显示 ID 和**当前渲染文本**（来自 `/api/preview` 附带的 per-component 文本），否则用户不知道 `tps` 长什么样。
- 拖拽过程只改前端 draft，不发请求；`/api/preview` 在 drop 后和滑块停止（debounce 120ms）时调用。
- 保存成功 → 服务端先写盘并关闭 server 的写接口，再 `settle(true)`；前端提示可关闭页面。

### 保存后如何生效

`src/index.ts` 的 `settings` 子命令（照抄 `handleReset` 的收尾，`src/command/actions.ts:96`）：

```ts
config = readPiStatusConfig();
if (lastCtx) installEditor(lastCtx);   // setEditorComponent 重装，才会换 zone
syncAnimation();
requestRender();
```

顺序不能反：`installEditor` 里 `createPiStatusEditorFactory` 捕获的是 `config` 的**当前值引用**，必须先重读再重装。

### 保存作用域

沿用现有 `writePiStatusConfig(config, "auto")` 语义（存在 `.pi/pi-status.json` 就写项目，否则写全局）。页面底部**只读展示**将要写入的路径，不给切换控件——加切换会引入“项目覆盖导致全局改动看不到”的困惑，等有真实需求再说。

### 预览用的运行时状态

`/api/preview` 使用 `cmdCtx.state`（活的 `RuntimeState`，含真实 git 分支、模型、context 百分比、cost）+ `ctx.ui.theme`。

因此预览里显示的就是**此刻你终端里那一条**，白捡一个 debug 能力。空状态（无 git 仓库、无模型）由各组件自己返回 `""`，`collectZoneSegments` 会跳过。

注意：`components/index.ts` 会被 server 端导入，其中 `git.ts` / `runtime.ts` 带 `node:child_process`。**只允许服务端导入**；`web/` 只允许 import `types.ts` / `constants.ts` / `settings/protocol.ts`，否则 vite 打包会炸。

## Files

新增：

- `apps/pi-status/src/settings/server.ts` — token/cookie、静态资源、3 个端点、CSP（约 200 行）
- `apps/pi-status/src/settings/preview.ts` — `renderPreview()`（约 50 行）
- `apps/pi-status/src/settings/protocol.ts` — 请求/响应类型，前后端共享（约 40 行）
- `apps/pi-status/web/index.html`
- `apps/pi-status/web/src/main.tsx`
- `apps/pi-status/web/src/styles.css` — 只 `@import "@taterdoge/ui/styles.css"` + 16 色调色板变量 + 等宽字体栈
- `apps/pi-status/web/src/App.tsx` — 页面骨架、draft 状态、保存流程（约 180 行）
- `apps/pi-status/web/src/canvas.tsx` — 画布框 + 4 个 zone 的 droppable + 卡片（约 150 行）
- `apps/pi-status/web/src/tray.tsx` — 未启用模块托盘（约 50 行）
- `apps/pi-status/web/src/ansi.tsx` — SGR → span（约 40 行）
- `apps/pi-status/web/src/settings.tsx` — 分隔符输入、进度条预设、宽度滑块（约 80 行）
- `apps/pi-status/components.json` — 照抄 pi-image-generate
- `apps/pi-status/vite.config.ts` — 照抄 pi-image-generate
- `apps/pi-status/test/settings-preview.test.js` — `renderPreview` 的宽度/截断断言
- `apps/pi-status/test/settings-server.test.js` — token 鉴权、校验失败返回 400、保存写盘
- `.changeset/<name>.md` — minor

修改：

- `apps/pi-status/src/index.ts` — 注册 `settings` 子命令 + 保存后重装 editor；导出 `startSettingsServer`
- `apps/pi-status/src/command/menu.ts` — 菜单加一行 “Open browser layout editor”
- `apps/pi-status/package.json` — `files` 加 `web/dist`；`scripts` 加 `build:web` / `dev:web`；devDeps 加 `@taterdoge/ui`、`@dnd-kit/react`、`@dnd-kit/helpers`、react 全家桶、vite、tailwind
- `apps/pi-status/tsconfig.json` — `lib` 加 `DOM`、`DOM.Iterable`；`jsx: react-jsx`；`include` 加 `web/src/**`
- `package.json`（根）— `typecheck` 追加 `-p apps/pi-status`（`docs/browser-ui-architecture.md` §8.3 明确点过这个坑）
- `apps/pi-status/README.md` — 新增 Settings 页面一节 + 截图
- `apps/pi-status/CHANGELOG.md` — 由 changeset 生成，不手改

不改：`src/types.ts`（数据模型不变）、`src/render.ts`、`src/border.ts`、`src/editor.ts`。

## Execution Steps

- [x] 1. `package.json` / `tsconfig.json` / 根 `typecheck` / `components.json` / `vite.config.ts` 接入 web 构建，跑通空页面。
- [x] 2. 写 `protocol.ts` + `preview.ts`，配 `test/settings-preview.test.js`：固定 config + 固定 width，断言 `fitBorder` 左边距、右内容先被截断、`top`/`bottom` 行长度等于 width。
- [x] 3. 写 `server.ts`（裁掉 secrets/descriptor），配 `test/settings-server.test.js`：无 cookie 访问 403、带 token 换 cookie 成功、非法 config POST 返回 400 且不写盘、合法 POST 写盘并 settle。
- [x] 4. `src/index.ts` 接 `settings` 子命令，保存后 `readPiStatusConfig` → `installEditor` → `syncAnimation` → `requestRender`。
- [x] 5. 前端 `ansi.tsx`：先做纯函数 + 快照断言（`\x1b[1;36mx\x1b[0m` → 粗体 cyan span；`\x1b[38;2;0;215;255m` → 真彩）。
- [x] 6. 前端 `canvas.tsx`：静态渲染 4 个 zone（不可拖），`/api/preview` 出真边框。
- [x] 7. 接入 `@dnd-kit/react`：组内排序 + 跨 zone 搬移 + 托盘进出，`onDragEnd` 只改 draft。
- [x] 8. `settings.tsx`：分隔符（限 visibleWidth ≤ 8，与 `handleSeparator` 一致）、进度条预设、宽度滑块。`contextBarStyle` 已有 `blocks` / `lines`。
- [x] 9. 重置默认 / 取消 / 保存并应用三按钮 + 底部写入路径展示。
- [ ] 10. 端到端手动验收：改配置 → 保存 → 终端立刻变；关页面再开，读回一致。
- [x] 11. README + changeset（截图待补）。
- [x] 12. `bun run check`（biome + boundaries + tsc ×3 + build:web）+ `bun test apps/pi-status/test`。

## Verification

```bash
cd /Users/taterdoge/Project/pi-packages
bun test apps/pi-status/test
bun run check
pi -e ./apps/pi-status
```

验收重点：

- `/pi-status settings` 打开页面，画布里显示的边框与终端当前**逐字符一致**（含截断位置）。
- 把 `git` 从 top-left 拖到 bottom-right，保存后终端立刻变，不需要重启 session。
- 拖到托盘 = 该模块消失；拖回来 = 恢复，且落回原 zone。
- 分隔符改成 12 个字符宽度会被拒绝（与 TUI 行为一致）。
- 非授权请求（无 cookie）返回 403；`/api/config` 提交未知 component id 或非法 zone 时返回 400，不写盘。
- 关闭页面 / 空闲 10 分钟后 server 自行退出，进程不残留。
- `web/dist` 进入 `npm pack` 产物（`files` 字段生效）。
- 浏览器 bundle 里不含 `node:child_process` / `node:fs`。

## 风险与已知缺口

1. **16 色保真度**：`STATUS_STYLES` 用的是原始 ANSI 16 色（`bold cyan` 等），浏览器只能用近似调色板。真彩部分（`theme.fg`）是精确的。缓解：备选方案 B 可完全消除。
2. **Nerd Font 半格偏差**：图标在 fallback 字体下宽度可能不同，右对齐差一格。缓解同上。
3. **`@dnd-kit/react` 仍是 0.x**：锁死 `0.5.1`，不跟 `^`。若出现兼容问题，降级 core+sortable（UI 代码不变，只换 hook）。
4. **`web/dist` 需要构建后才可用**：`files` 里带 `web/dist`，但本地开发必须先 `bun run build:web`。CI 的 `bun run check` 已包含 build:web。
5. **只支持 4 个 zone**：终端边框模型决定的上限，不做自由坐标。这个限制写进 README，避免期望落空。
