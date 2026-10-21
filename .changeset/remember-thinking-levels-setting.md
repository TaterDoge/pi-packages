---
"@taterdoge/pi-remember-model": patch
---

Store per-model thinking levels in Pi's own `modelThinkingLevels` instead of the plugin cache. Pi's startup resolver reads that map and never read `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`, so a restarted session always fell back to `defaultThinkingLevel` and dropped the level you picked. `modelThinkingLevels` is the same key `/settings` edits, so both stay in sync.
