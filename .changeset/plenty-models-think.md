---
"@taterdoge/pi-remember-model": patch
---

Persist the thinking level per model in `modelThinkingLevels` and re-apply it with `pi.setThinkingLevel()` on model switches. Pi only reads that setting while booting, so the previous global `defaultThinkingLevel` write both leaked a clamped level into other models and never reached the running session — switching away from a model and back dropped the level you had chosen.
