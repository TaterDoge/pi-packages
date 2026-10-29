---
"@taterdoge/pi-status": patch
---

新增两个默认关闭的模块：`cache` 显示会话期间的 prompt 缓存命中率（缓存写入算未命中，provider 无缓存数据时不显示），`elapsed` 显示会话已耗时（按分钟取整）。两者都能在 `/pi-status` 拖拽页里开启。
