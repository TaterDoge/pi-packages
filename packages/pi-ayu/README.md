# @taterdoge/pi-ayu

Ayu-inspired themes for the Pi Coding Agent. This package provides both dark and light Ayu variants as installable Pi themes.

## Available Themes

| ayu-dark | ayu-light |
|:---:|:---:|
| ![ayu-dark](./assets/dark.png) | ![ayu-light](./assets/light.png) |

- `ayu-dark` (dark)
- `ayu-light` (light)

## Install

```shell
pi install npm:@taterdoge/pi-ayu
```

Or try without installing

```shell
pi -e npm:@taterdoge/pi-ayu
```

Then select a theme via `/settings`.

## Local Development

Run Pi with this local package:

```shell
pi -e ./packages/pi-ayu
```

Or install it from the local path:

```shell
pi install ./packages/pi-ayu
```

## Uninstall

```shell
pi remove npm:@taterdoge/pi-ayu
```
