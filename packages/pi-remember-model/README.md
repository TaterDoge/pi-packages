# @taterdoge/pi-remember-model

[![npm version](https://img.shields.io/npm/v/@taterdoge/pi-remember-model.svg)](https://www.npmjs.com/package/@taterdoge/pi-remember-model) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Pi extension that persists the last selected model and each model's thinking level to Pi's global `settings.json`, so every new session starts where you left off.

## Install

```shell
pi install npm:@taterdoge/pi-remember-model
```

Or try without installing:

```shell
pi -e npm:@taterdoge/pi-remember-model
```

## How it works

- On model selection, writes `defaultProvider` and `defaultModel` to the global settings file (`~/.pi/agent/settings.json`, or `$PI_CODING_AGENT_DIR/settings.json`)
- On thinking level selection, writes a per-model entry to `modelThinkingLevels`, keyed `"provider/modelId"` — Pi's own setting, so a level one model cannot support never leaks into another model. Pi's startup resolver reads this map, so a new session opens on the level you last used for its model
- On model selection, re-applies that model's level with `pi.setThinkingLevel()`: Pi keeps its own in-memory copy of `modelThinkingLevels` and never picks up a mid-session write, so switching back to a model needs that nudge
- Existing settings keys are preserved (read-merge-write); a missing or invalid file is started fresh
- Session-restore events (`source: "restore"`) are ignored, so merely opening an old session never rewrites your default
- `defaultThinkingLevel` is never written: it is the global fallback for every model

## Files

Everything goes into Pi's own global settings — the same keys Pi reads at startup:

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

`modelThinkingLevels` is the same map `/settings` edits and Pi's startup resolver reads, so `/settings` and this extension stay in sync instead of keeping two copies.

Upgrading from 0.1.2: that release kept levels in `~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`, which Pi never read. Merge those entries into `modelThinkingLevels` by hand (or re-pick the levels once); the file is no longer used.

`pi.setThinkingLevel()` has existed since Pi 0.76. On any supported Pi the extension remembers the model and re-applies its level when you switch back.

Note: Pi ≥ 0.76 already reads `modelThinkingLevels` at startup, but only `/settings` writes it, so switching a level in-session (`Enter` in the thinking selector, which is session-only, or `Ctrl+S`, which sets the **global** default for every model) leaves no per-model record. This extension fills that gap.
