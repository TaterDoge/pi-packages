# 浏览器 UI 架构：只共享 shadcn，渲染归各扩展

> 分支：`feat/pi-settings-base` → 已改为本方案
> 记录目的：说明为什么放弃「共享设置基座」，以及当前边界怎么划。

## 1. 结论

**共享的只有 shadcn/ui 组件。** 每个 Pi 扩展自己实现 web 页面、自己的路由、自己的 server。

```text
apps/                         可安装的 Pi 包
├── pi-ayu/                   主题
├── pi-image-generate/        扩展 + skills + web/（自己的页面与构建产物）
├── pi-remember-model/        TUI 扩展
└── pi-status/                TUI 扩展

packages/                     仅共享库，不单独安装
└── ui/                base-nova 组件源码 + theme + Tailwind 令牌
```

## 2. 为什么放弃 descriptor 方案

上一版让每个扩展提供一份 descriptor（9 种字段类型），由共享 React 一次性渲染，试图「共享前端运行时」。实测后走不通：

| 问题 | 具体表现 |
| --- | --- |
| DSL 表达力上限 | `SettingsField` 是封闭联合，没有 drag / canvas / 实时预览。`list` 只能增删，**不能重排**。 |
| 加不进去 | 要支持画布就得允许 `render: (value) => JSX`，那样 descriptor 不再可 JSON 序列化，等于开「ES module 热插拔自定义控件」——同一份设计记录里明确拒绝过的东西。 |
| 真实倒退 | 模型自动发现 action 服务端有实现有测试，前端却画不出来，只能降级成手动逐条添加。这正是 DSL 的直接代价。 |
| 体积不划算 | 共享 dist 是 470K × 1 vs 各带 470K。只有在 UI 插件 ≥3 时才有摊薄收益，而当时是 1。 |

典型反例是 `pi-status`：它的理想界面是「12 个固定组件拖进 4 个 zone + 实时预览状态栏」。这是表单的反面，用 `record` 硬凑会让用户能删掉本该固定的组件。

## 3. 现在共享什么

`packages/ui` 只放重复定义的东西：

| 导出 | 内容 |
| --- | --- |
| `components/ui/*` | shadcn `base-nova` 生成件（button / card / checkbox / field / input / label / select / separator / switch / tabs / textarea） |
| `lib/theme` | `initialTheme` / `applyTheme` / `THEME_STORAGE_KEY` |
| `styles.css` | Tailwind 入口 + light/dark 设计令牌 |

消费方自己声明 `@base-ui/react` `class-variance-authority` `cn` `lucide-react` `react` `tailwindcss` 等（peer），避免重复 React。

**组件以源码而非 dist 共享**，所以照样能改 className，不牺牲可定制性。

## 4. 每个扩展自己拥有什么

以 `pi-image-generate` 为例：

```text
apps/pi-image-generate/
├── src/
│   ├── settings/server.ts   284行  路由 + 鉴权 + mask/restore + CSP
│   ├── settings/types.ts    121行  它自己的 descriptor 类型（本包内部用，不对外）
│   ├── settings/path.ts     118行  点路径 + 遮蔽还原
│   └── descriptor.ts        246行  它自己的表单声明
├── web/                            React 页面，只能用收到的东西
│   └── dist/                       随包发布
```

这些都不再从共享包导入。别的扩展想画什么形状的界面就画什么，不再受任何协议约束。

`web/src/styles.css` 只需一行：

```css
@import "@taterdoge/ui/styles.css";
```

## 5. 安全不变式（留在扩展内，但仍是硬要求）

`server.ts` 迁进来了，规则不变：

- 一次性 token 换 cookie，`HttpOnly; SameSite=Strict`，只监听 `127.0.0.1`
- `secrets` 命中的叶子以 `••••••••` 下发；回传仍是占位符就还原成持久化旧值
- `args`（浏览器传）与 `runtime`（服务端注入）分离，浏览器无法注入凭据解析器
- 空闲 10 分钟自动关闭
- 静态资源带 CSP

**为什么这些仍然必须逐条遵守**：它们不是可以"以后再补"的优化。mask/restore 失效 = 用户只改 outputDir 保存一次就丢一次明文 API key。

## 6. 仓库约定（配套改动）

- `package.json` workspaces：`apps/*` + `packages/*`
- `scripts/check-extension-boundaries.mjs`：扫描两个根；无 `pi.extensions` 的包不算扩展
- `biome.json`：`packages/ui/src/components/ui/**` 豁免 a11y / noDoubleEquals / noArrayIndexKey（shadcn 生成件与仓库规则的固有冲突）
- 根 `typecheck`：根 `tsc` 只覆盖 `*.ts`，**`.tsx` 必须由各自的 tsconfig 单独检查**，否则 web 页面等于没类型检查。当前显式追加 `-p packages/ui` 与 `-p apps/pi-image-generate`；新增带 web 的包要一起加。
- 共享包内组件之间用相对导入（`./label.tsx`），不依赖消费方的 path alias。

## 7. 实测

| 项 | 结果 |
| --- | --- |
| `bun run check`（biome + 边界 + tsc ×3 + vite build） | 通过 |
| `packages/ui` 测试 | 3 pass |
| `apps/pi-image-generate` 测试 | 59 pass / 0 fail |
| web 产物 | JS 413K / CSS 14.8K（CSS 从 55K 降至 14.8K：Tailwind 现在只扫本扩展源码） |

## 8. 已知缺口

### 8.1 模型自动发现仍无 UI

服务端 `discover-models` action 有测试，前端没有 picker。旧 Solid 版有一个带搜索/多选的组件，这次迁移没搬。现在没有 DSL 挡着，补它就是个普通多选组件。

### 8.2 加 web 的扩展要重复基础设施

第二个带浏览器页面的扩展会再复制一遍 `settings/server.ts`（约 230 行鉴权 + 静态资源 + CSP）。**这是有意接受的成本**：抽象它的收益要等第三个 UI 插件，而代价是现在就要把「页面长什么样」交给共享层决定。

如果真出现第三个，正确的共享方式是**把 server 的 HTTP 骨架抽成库（不含 descriptor）**，让各扩展注册自己的路由处理器 —— 而不是再回到描述式表单。

### 8.3 根类型检查漏 `.tsx` 是容易复发的问题

根 `tsc` include 只有 `*.ts`。新增带 web 的包时若忘记往根 `typecheck` 追加 `-p`，页面会在没有类型检查的情况下通过 CI。
