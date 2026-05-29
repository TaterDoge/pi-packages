# Pi Extensions Monorepo

This repository is a Bun workspaces monorepo for building and testing Pi extensions locally.

## Layout

```txt
packages/
├── pi-ayu/
│   ├── src/
│   │   └── ayu.ts
│   ├── LICENSE
│   ├── README.md
│   └── package.json
```

## Quick start

```bash
bun install
bun run check
```

Run an extension directly with Pi:

```bash
pi -e ./packages/pi-ayu
```

Or install from a local package path:

```bash
pi install ./packages/pi-ayu
```

## Add a new extension

1. Copy an existing package (e.g. `packages/pi-ayu`) to `packages/pi-your-extension`
2. Rename the package, extension entry, command, and tool names
3. Add a new `pack:*` script in the root `package.json` if needed
4. Run `bun run check`

## Notes

- Each extension package keeps its own `package.json` and `README.md`.
- The root workspace handles shared linting and type-check scripts.
- Pi packages should expose extensions through the `pi.extensions` field.
