# Pi Packages Changelog

This is a monorepo containing multiple Pi extension packages. See each package's individual changelog for details.

## Packages

| Package | Version | Changelog |
|---------|---------|-----------|
| [@taterdoge/pi-ayu](./packages/pi-ayu/README.md) | 0.1.3 | [CHANGELOG](./packages/pi-ayu/CHANGELOG.md) |
| [@taterdoge/pi-status](./packages/pi-status/README.md) | 1.1.0 | [CHANGELOG](./packages/pi-status/CHANGELOG.md) |

## How We Version

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs. To make a change:

1. Run `bun changeset` and describe your change (patch/minor/major)
2. Commit the generated changeset file along with your code
3. When ready to release, run `bun changeset version` to bump versions and update CHANGELOGs
4. Create a new tag and publish with `bun run release`
