# @taterdoge/pi-status

[![npm version](https://img.shields.io/npm/v/@taterdoge/pi-status.svg)](https://www.npmjs.com/package/@taterdoge/pi-status) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Configurable Pi extension that wraps the Editor with a live status bar using border decorations.

![preview](./assets/preview.png)

## Features

- Status bar rendered as border decorations around the Editor
- Four configurable zones: top-left, top-right, bottom-left, bottom-right
- Real-time segments for activity state, cwd, turn, active tool, git, runtime, model, thinking, TPS, tokens, context, and cost
- Configurable components, zones, and separator
- Interactive `/pi-status` menu for toggling settings
- Project/global settings stored in standalone `pi-status.json` files

## Install

```shell
pi install npm:@taterdoge/pi-status
```

Or try without installing:

```shell
pi -e npm:@taterdoge/pi-status
```

## Commands

```text
/pi-status                open interactive menu
/pi-status components     configure components and zones
/pi-status separator      change the separator
/pi-status reset          write default config to pi-status.json
```

### Available components

| Component ID | Description | Default Zone |
| --- | --- | --- |
| `status` | Activity state: idle, running, tool, error, or stale | top-left |
| `cwd` | Working directory basename | top-left |
| `turn` | Current turn number | top-left |
| `current_tool` | Currently executing tool name | top-left |
| `git` | Git branch plus dirty/ahead-behind summary | top-left |
| `runtime` | Detected project runtime and version | top-left |
| `model` | Current provider + model | bottom-left |
| `thinking` | Thinking level | bottom-left |
| `tps` | Tokens per second | bottom-left |
| `tokens` | Session input/output token totals | bottom-right |
| `context` | Context window usage | bottom-right |
| `cost` | Session accumulated cost | bottom-right |

## Configuration

Settings are stored in standalone `pi-status.json` files, not merged from Pi `settings.json`:

- `~/.pi/agent/pi-status.json` for global settings
- `.pi/pi-status.json` for project-local settings

Project settings take precedence over global settings when `.pi/pi-status.json` exists. Existing legacy `piStatus` settings are migrated once into `pi-status.json` only when no standalone config already exists.

Default config:

```json
{
  "separator": " · ",
  "components": [
    { "id": "status", "enabled": true, "zone": "top-left" },
    { "id": "cwd", "enabled": true, "zone": "top-left" },
    { "id": "turn", "enabled": true, "zone": "top-left" },
    { "id": "current_tool", "enabled": true, "zone": "top-left" },
    { "id": "git", "enabled": true, "zone": "top-left" },
    { "id": "runtime", "enabled": true, "zone": "top-left" },
    { "id": "model", "enabled": true, "zone": "bottom-left" },
    { "id": "thinking", "enabled": true, "zone": "bottom-left" },
    { "id": "tps", "enabled": true, "zone": "bottom-left" },
    { "id": "tokens", "enabled": true, "zone": "bottom-right" },
    { "id": "context", "enabled": true, "zone": "bottom-right" },
    { "id": "cost", "enabled": true, "zone": "bottom-right" }
  ]
}
```

## Environment

Disable the extension by default:

```shell
PI_STATUS_DISABLED=1 pi
```

Accepted truthy values are `1`, `true`, `yes`, and `on`.

## Local Development

Run Pi with this local package:

```shell
pi -e ./packages/pi-status
```

Or install it from the local path:

```shell
pi install ./packages/pi-status
```

## Uninstall

```shell
pi remove npm:@taterdoge/pi-status
```

## Credits

Status-bar content and layout were adapted from a custom implementation, then moved to Pi's border decoration system for this package.
