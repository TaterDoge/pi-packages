# @taterdoge/pi-remember-model

## 0.1.2

### Patch Changes

- [`3c8543d`](https://github.com/TaterDoge/pi-packages/commit/3c8543d1c1211a60d45b32670f5a3bfdce8b7b09) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Store per-model thinking levels in the plugin directory (`~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`) instead of `modelThinkingLevels` in Pi's `settings.json`. Model defaults (`defaultProvider` / `defaultModel`) are unchanged.

## Unreleased

### Patch Changes

- Store per-model thinking levels in `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json` instead of `modelThinkingLevels` in Pi's `settings.json`. Model defaults (`defaultProvider` / `defaultModel`) are unchanged.

## 0.1.1

### Patch Changes

- [`92f4c84`](https://github.com/TaterDoge/pi-packages/commit/92f4c84badf1ad33af7c800440f1a8d9d7bcc729) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Persist the thinking level per model in `modelThinkingLevels` and re-apply it with `pi.setThinkingLevel()` on model switches. Pi only reads that setting while booting, so the previous global `defaultThinkingLevel` write both leaked a clamped level into other models and never reached the running session — switching away from a model and back dropped the level you had chosen.

## 0.1.0

### Initial Release

- Persist the last selected model (`defaultProvider` / `defaultModel`) and thinking level (`defaultThinkingLevel`) to Pi's global settings.json
- Read-merge-write patching that preserves unrelated settings keys
- Ignores session-restore model events so opened sessions never rewrite the default
