# @taterdoge/pi-image-generate

## 0.3.0

### Minor Changes

- [`512c0ff`](https://github.com/TaterDoge/pi-packages/commit/512c0ff35cef74f15dfc040884eaab36ddb767c2) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Add a light/dark theme toggle to the settings page, remembered in `localStorage` and applied before first paint.

- [`29dda3a`](https://github.com/TaterDoge/pi-packages/commit/29dda3a3dc5b4cd9d45574d84b12dbebb7fa411e) Thanks [@TaterDoge](https://github.com/TaterDoge)! - Rebuild the settings page on Solid with Zaidan components.

  The web UI is no longer React: `vite-plugin-solid` and `solid-js` replace the
  React renderer, `@kobalte/core` replaces the Radix primitives, and the layout
  comes from the [Zaidan](https://zaidan.carere.dev) registry over Tailwind CSS
  tokens. Zaidan's components express their visuals through a `z-*` style layer
  that is not published alongside the registry items, so the imported files carry
  the equivalent utilities instead of those hooks.

  Typing an ID was broken: the provider, model, and protocol ID inputs were keyed
  by their own value, so every keystroke renamed the field's key, remounted the
  row, and dropped focus after a single character. ID edits now buffer locally and
  commit on blur or Enter, reverting when the new ID is empty or already taken.

  Other UI fixes: the switch toggles now receive clicks (the control had no
  handler), JSON textareas no longer reformat while you type, and the settings
  page no longer renders a transparent page background.

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
