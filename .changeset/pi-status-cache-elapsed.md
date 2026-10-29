---
"@taterdoge/pi-status": patch
---

新增两个模块：`cache` 显示会话期间的 prompt 缓存命中率（缓存写入算未命中；默认开启，provider 无缓存数据时显示 `0%`），`elapsed` 显示会话已耗时（按分钟向下取整；默认关闭）。两者都能在 `/pi-status` 拖拽页里开关。
