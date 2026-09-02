# @taterdoge/pi-remember-model

[![npm version](https://img.shields.io/npm/v/@taterdoge/pi-remember-model.svg)](https://www.npmjs.com/package/@taterdoge/pi-remember-model) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Pi extension that persists the last selected model and thinking level to Pi's global `settings.json`, so every new session starts where you left off.

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
- On thinking level selection, writes `defaultThinkingLevel`
- Existing settings keys are preserved (read-merge-write); a missing or invalid file is started fresh
- Session-restore events (`source: "restore"`) are ignored, so merely opening an old session never rewrites your default

## Settings file

The extension patches Pi's own global settings — the same keys Pi reads at startup:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-6",
  "defaultThinkingLevel": "medium"
}
```

Note: Pi ≥ 0.76 already persists model/thinking-level choices natively; this extension is mainly useful on older Pi versions or as an explicit safety net.
