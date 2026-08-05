# @taterdoge/pi-image-generate

## 0.2.0

### Minor Changes

- [`e566705`](https://github.com/TaterDoge/pi-packages/commit/e56670568647c1eb9d87037542d37a6358ca88ef) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Publish the initial skill-driven image generation package with configurable providers, models, protocols, live task status, and a global settings workflow.

## 0.1.0

### Initial Release

- Added a skill-driven `image_generate` tool with a fixed configurable default model
- Added `/image-generate` shorthand, subcommands, completions, live status, and browser-tab image previews after generation
- Added local browser settings built with React, Tailwind CSS, and shadcn/ui for provider/model/protocol editing
- Added searchable provider `/models` discovery with checkbox multi-select and batch model import
- Added OpenAI Images, Gemini generateContent, and generic synchronous/asynchronous JSON protocols
- Added safe credentials, cancellation, image inputs, bounded responses, and atomic non-overwriting output files
