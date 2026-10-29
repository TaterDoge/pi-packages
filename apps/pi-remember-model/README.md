# @taterdoge/pi-remember-model

[![npm version](https://img.shields.io/npm/v/@taterdoge/pi-remember-model.svg)](https://www.npmjs.com/package/@taterdoge/pi-remember-model) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Pi extension that remembers the model you picked in each directory, plus each model's thinking level, so every new session starts where you left off — and a model switch in one pi instance no longer leaks into another one running elsewhere.

## Install

```shell
pi install npm:@taterdoge/pi-remember-model
```

Or try without installing:

```shell
pi -e npm:@taterdoge/pi-remember-model
```

## How it works

Model memory is **per directory**: switching a model in `/repo/a` never changes what `/repo/b` opens with.

- On model selection, records `{provider, id}` for the current working directory in `extensions/pi-remember-model/models.json`
- On session start, if that directory has a record, applies it with `pi.setModel()`. This runs for `/new` and fork, which otherwise fall back to Pi's global default. Pi already restores a model from a resumed session's own `model_change` entry, so a resume keeps its model
- The remembered model is only applied when the session is still sitting on Pi's global default. A `--model` flag or a resumed session that already claimed the slot is left alone
- Applying the model is done with `pi.setModel()`, which is session-only — the restore never writes back, so session starts cannot drift your global default
- `defaultProvider`/`defaultModel` are still written on a switch, as the fallback for directories with no record yet. This means the global default follows your most recent switch; it is only ever a fallback, never a cross-directory override
- On thinking level selection, writes a per-model entry to `modelThinkingLevels`, keyed `"provider/modelId"` — Pi's own setting, so a level one model cannot support never leaks into another model. Pi's startup resolver reads this map, so a new session opens on the level you last used for its model. Thinking levels stay global on purpose: they belong to a model, not a directory
- On model selection, re-applies that model's level with `pi.setThinkingLevel()`: Pi keeps its own in-memory copy of `modelThinkingLevels` and never picks up a mid-session write, so switching back to a model needs that nudge
- Existing settings keys are preserved (read-merge-write); a missing or invalid file is started fresh
- Session-restore events (`source: "restore"`) are ignored, so merely opening an old session never rewrites your default or the directory's record
- `defaultThinkingLevel` is never written: it is the global fallback for every model

## Files

`~/.pi/agent/extensions/pi-remember-model/models.json` (or `$PI_CODING_AGENT_DIR/extensions/pi-remember-model/models.json`) — one entry per directory, keyed by absolute path:

```json
{
  "/repo/a": { "provider": "anthropic", "id": "claude-opus-4-6" },
  "/repo/b": { "provider": "xai", "id": "grok-4.6" }
}
```

The directory is created on first write. Deleted or moved directories leave a stale key behind; it costs nothing and is reused if the path comes back. Delete the file to start every directory fresh.

Pi's own global settings still hold the fallback and the per-model levels:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-6",
  "modelThinkingLevels": {
    "anthropic/claude-opus-4-6": "xhigh",
    "openai/gpt-5": "low"
  }
}
```

`modelThinkingLevels` is the same map `/settings` edits and Pi's startup resolver reads, so `/settings` and this extension stay in sync instead of keeping two copies. Keeping it global instead of per-directory is what makes a level survive a `/new` in any directory.

Upgrading from 0.1.2: that release kept levels in `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`, which pi never read. On first load this extension folds any valid entries into `modelThinkingLevels` and then deletes the file. A level re-picked since the upgrade wins over the stale one; entries pi does not recognise are dropped. Nothing to do by hand.

`pi.setThinkingLevel()` has existed since Pi 0.76. On any supported Pi the extension remembers the model and re-applies its level when you switch back.

Note: Pi ≥ 0.76 already reads `modelThinkingLevels` at startup, but only `/settings` writes it, so switching a level in-session (`Enter` in the thinking selector, which is session-only, or `Ctrl+S`, which sets the **global** default for every model) leaves no per-model record. This extension fills that gap.
