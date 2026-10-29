---
"@taterdoge/pi-status": patch
---

修复关闭设置网页后 `/pi-status` 命令再也无法执行。

- 命令 handler 不再 await 网页结果：此前 handler 一直挂着，TUI 的 `session.prompt` 就被阻塞，关掉网页后 `/pi-status`、`/pi-status help`、`/pi-status settings` 全部失效，直到 10 分钟空闲超时。
- 页面在 `pagehide` 时向 `/api/leave` 发 beacon，服务端在 1.5 秒宽限期后自行关闭并 resolve，关标签页不再需要等空闲超时。
- 宽限期内任何请求（包括刷新后重新拉取 `/api/config`）都会取消这次关闭，刷新页面不会断开；进入 bfcache 的页面不发 beacon，返回时仍可用。
- `close()` 追加 `closeAllConnections()`，旧页面的 keep-alive 连接不会让再次执行 `/pi-status` 卡住。
