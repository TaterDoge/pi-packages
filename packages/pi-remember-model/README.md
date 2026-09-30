# @taterdoge/pi-remember-model

[![npm version](https://img.shields.io/npm/v/@taterdoge/pi-remember-model.svg)](https://www.npmjs.com/package/@taterdoge/pi-remember-model) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Pi extension that persists the last selected model to Pi's global `settings.json` and the thinking level to the plugin's own cache, so every new session starts where you left off.

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
- On thinking level selection, writes a per-model entry in the plugin cache (`~/.pi/agent/extensions/pi-remember-model/thinking-levels.json`), keyed `"provider/modelId"`, so a level one model cannot support never leaks into another model and Pi's own `settings.json` stays untouched
- On model selection, re-applies that model's remembered level with `pi.setThinkingLevel()` — the cache is not a Pi setting, so nothing else reads it at boot
- Existing settings keys are preserved (read-merge-write); a missing or invalid file is started fresh
- Session-restore events (`source: "restore"`) are ignored, so merely opening an old session never rewrites your default

## Files

Model choice goes into Pi's own global settings — the same keys Pi reads at startup:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-6"
}
```

Thinking levels stay in the plugin directory (`$PI_CODING_AGENT_DIR/extensions/pi-remember-model/thinking-levels.json`, default `~/.pi/agent/extensions/pi-remember-model/`):

```json
{
  "anthropic/claude-opus-4-6": "xhigh",
  "openai/gpt-5": "low"
}
```

`pi.setThinkingLevel()` has existed since Pi 0.76. On any supported Pi the extension remembers the model and re-applies the cached level when you switch back.

Note: Pi ≥ 0.76 already persists model/thinking-level choices natively; this extension is mainly useful on older Pi versions or as an explicit safety net.
