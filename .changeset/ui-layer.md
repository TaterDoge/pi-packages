---
"@taterdoge/ui": minor
"@taterdoge/pi-image-generate": minor
---

重构：共享层只保留 shadcn/ui 组件，浏览器设置页回归各扩展自己实现。

- 新增 `@taterdoge/ui`：`base-nova` 组件源码、`lib/theme`、`styles.css` 设计令牌。只共享真正重复定义的部分，不含路由、server 或表单抽象。
- 移除 `@taterdoge/pi-settings`（未发布，无外部影响）：descriptor 协议、通用渲染层与其 server 一并删除。每套设置页的表现形式差别太大（表单 / 画布 / 预览），抽象成共享 DSL 会限制各扩展，且共享包体积只在扩展数量 ≥3 时才有摊薄收益。
- `pi-image-generate` 收回自己的 `web/` 页面与 `src/settings/server.ts`，`web/dist` 随包发布。
- 仓库布局改为 `apps/`（可安装的 Pi 包）与 `packages/`（仅共享库）。
