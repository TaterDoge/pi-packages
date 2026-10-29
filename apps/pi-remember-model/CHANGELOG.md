# @taterdoge/pi-remember-model

## 0.2.1

### Patch Changes

- [`fb8b817`](https://github.com/TaterDoge/pi-packages/commit/fb8b8176d07bd6d1e37e0b9a377500e619594bb9) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Leave an explicit `--model` / `--models` alone instead of letting the directory record override it.

  The 0.2.0 notes said a `--model` flag keeps priority, but the code only checked `onGlobalDefault()` — "the session still holds `defaultProvider`/`defaultModel`". A flag never writes settings.json, so that check cannot see one, and it passed whenever the settings default happened to hold the same model the flag named. A manual switch in any pi instance writes that default, so the flag was honored on most starts and silently overridden on others.

  The one that breaks in practice is a subagent: `pi-subagents` starts every background child as `pi --model <provider/id>` from the agent's own model, so a `reviewer`/`oracle` pinned to a strong model was pulled back to whatever model that directory last used, thinking level included. `session_start` now scans argv first and returns when a model was named on the command line. A directory record is still applied on `startup`, `new` and `fork`, and a resumed session's own `model_change` still wins as before.

## 0.2.0

### Minor Changes

- [`b7990aa`](https://github.com/TaterDoge/pi-packages/commit/b7990aa2345024259c6af9afb2664300b41009de) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Remember the selected model **per directory**. Switching a model in one pi instance no longer changes what a session in another directory opens with on `/new` or `/reload`.

  `model_select` still writes `defaultProvider`/`defaultModel` — that stays the fallback for directories with no record — but it now also records the directory's model in `~/.pi/agent/extensions/pi-remember-model/models.json`, keyed by absolute path. On `session_start` the extension applies that record with `pi.setModel()`, which is session-only, so the restore never writes back and session starts cannot drift the global default.

  The record is applied only when the session still sits on the global default, so a `--model` flag and a resumed session's own `model_change` both keep priority. Thinking levels stay global in pi's own `modelThinkingLevels` map: a level belongs to a model, not to a directory, so it must survive `/new` anywhere.

  Upgrading from 0.1.2 now cleans up after itself: the extension folds any valid entries from the old `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json` into `modelThinkingLevels` and deletes the file. A level re-picked since the upgrade wins; unrecognised entries are dropped. Previously that file was left behind, so a level picked before upgrading was silently lost.

## 0.1.3

### Patch Changes

- [`5abaa2c`](https://github.com/TaterDoge/pi-packages/commit/5abaa2cdf210b9466d831122b6fc9ddb88f73bac) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Store per-model thinking levels in Pi's own `modelThinkingLevels` instead of the plugin cache. Pi's startup resolver reads that map and never read `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`, so a restarted session always fell back to `defaultThinkingLevel` and dropped the level you picked. `modelThinkingLevels` is the same key `/settings` edits, so both stay in sync.

## 0.1.2

### Patch Changes

- [`3c8543d`](https://github.com/TaterDoge/pi-packages/commit/3c8543d1c1211a60d45b32670f5a3bfdce8b7b09) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Store per-model thinking levels in the plugin directory (`~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`) instead of `modelThinkingLevels` in Pi's `settings.json`. Model defaults (`defaultProvider` / `defaultModel`) are unchanged.

## Unreleased

### Patch Changes

- Store per-model thinking levels back in Pi's own `modelThinkingLevels` in `settings.json` instead of the plugin cache. Pi's startup resolver reads that map and never read the plugin file, so a restarted session always fell back to `defaultThinkingLevel` and dropped the level you picked. `modelThinkingLevels` is the same key `/settings` edits, so the two stay in sync.

## 0.1.1

### Patch Changes

- [`92f4c84`](https://github.com/TaterDoge/pi-packages/commit/92f4c84badf1ad33af7c800440f1a8d9d7bcc729) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Persist the thinking level per model in `modelThinkingLevels` and re-apply it with `pi.setThinkingLevel()` on model switches. Pi only reads that setting while booting, so the previous global `defaultThinkingLevel` write both leaked a clamped level into other models and never reached the running session — switching away from a model and back dropped the level you had chosen.

## 0.1.0

### Initial Release

- Persist the last selected model (`defaultProvider` / `defaultModel`) and thinking level (`defaultThinkingLevel`) to Pi's global settings.json
- Read-merge-write patching that preserves unrelated settings keys
- Ignores session-restore model events so opened sessions never rewrite the default
