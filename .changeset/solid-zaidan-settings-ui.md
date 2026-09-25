---
"@taterdoge/pi-image-generate": minor
---

Rebuild the settings page on Solid with Zaidan components.

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
