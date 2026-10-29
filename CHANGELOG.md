# Pi Packages Changelog

This is a monorepo containing multiple Pi extension packages. See each package's individual changelog for details.

## Packages

| Package | Version | Changelog |
| --- | --- | --- |
| [@taterdoge/pi-ayu](./apps/pi-ayu/README.md) | 0.1.3 | [CHANGELOG](./apps/pi-ayu/CHANGELOG.md) |
| [@taterdoge/pi-image-generate](./apps/pi-image-generate/README.md) | 0.3.0 | [CHANGELOG](./apps/pi-image-generate/CHANGELOG.md) |
| [@taterdoge/pi-remember-model](./apps/pi-remember-model/README.md) | 0.2.0 | [CHANGELOG](./apps/pi-remember-model/CHANGELOG.md) |
| [@taterdoge/pi-status](./apps/pi-status/README.md) | 1.2.1 | [CHANGELOG](./apps/pi-status/CHANGELOG.md) |

## How We Version

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs. To make a change:

1. Run `bun changeset` and describe your change (patch/minor/major)
2. Commit the generated changeset file along with your code
3. When ready to release, run `bun changeset version` to bump versions and update CHANGELOGs
4. Create a new tag and publish with `bun run release`
