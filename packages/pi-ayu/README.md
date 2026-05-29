# @taterdoge/pi-ayu

Ayu-inspired themes for Pi, based on the dark and light palettes from [ayu-colors](https://github.com/ayu-theme/ayu-colors/tree/master/themes).

## What it adds

- `ayu-dark` - low-contrast dark surface with Ayu amber, blue, green, and coral accents
- `ayu-light` - clean light surface with the same Ayu syntax and status palette

## Local usage

Run Pi with this local package:

```bash
pi -e ./packages/pi-ayu
```

Or install it from the local path:

```bash
pi install ./packages/pi-ayu
```

Then open `/settings` and choose `ayu-dark` or `ayu-light`.

You can also set the theme directly in `settings.json`:

```json
{
  "theme": "ayu-dark"
}
```

## Development

```bash
bun install
bun run --cwd packages/pi-ayu check
```

The package exposes its themes through the `pi.themes` manifest field in `package.json`.
