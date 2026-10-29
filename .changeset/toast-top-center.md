---
"@taterdoge/ui": minor
---

Toast 从 Base UI 换成 sonner：新增 `components/ui/sonner`（`Toaster` + 复出的 `toast` 单例），删除 `components/ui/toast`。

- 位置改由 sonner 的 `position` prop 控制，pi-status 设为 `top-center`。
- sonner 的配色变量接到本项目令牌（popover / border / radius），随 `.dark` 自动切换。
