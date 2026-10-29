---
name: image-generate
description: Generate or edit raster images with the image_generate tool. Use for photos, illustrations, textures, sprites, product or UI mockups, concept art, reference-guided generation, and image-to-image edits. Do not use for SVG/vector assets or deterministic code-native diagrams.
---

# Image generation

Use the `image_generate` tool for bitmap generation and editing. The active model is fixed by global `pi-image-generate.defaultModel`; the tool intentionally has no `model` parameter. Never invent or pass a model name. If the user wants to switch models, direct them to `/image-generate settings`.

## When to use

- New raster assets: photos, illustrations, textures, sprites, concept art, cover or hero images.
- Product shots and UI/product mockups where a generated bitmap is desired.
- Reference-guided generation for style, composition, mood, or subject identity.
- Editing: object removal, background replacement, inpainting-like changes, relighting, compositing, and style transfer.

## When not to use

- SVG icons, logos, diagrams, wireframes, or assets that should match an existing code-native vector system.
- Deterministic HTML/CSS/canvas output.
- An existing editable native asset where a direct source edit is more appropriate.

## Decide generate vs edit

- No `image`, or images used only as references: new generation.
- User asks to change an existing bitmap while preserving most of it: pass that image as an edit target.
- Label each input by role in the prompt, for example: `Image 1: edit target; Image 2: style reference`.
- For edits, state invariants every time: `change only X; keep Y unchanged`.

## Prompt structure

Preserve the user's intent. Normalize specific requests without adding unrequested characters, props, brand claims, slogans, or story beats.

For complex work, order the prompt as:

```text
Use case: <photo, illustration, texture, mockup, concept art>
Primary request: <the main task>
Input images: <Image 1 role; Image 2 role>
Scene/backdrop: <environment>
Subject: <subject and key details>
Style/medium: <visual medium>
Composition/framing: <camera, framing, negative space>
Lighting/mood: <lighting and atmosphere>
Color palette: <palette constraints>
Text (verbatim): "<exact text>"
Constraints: <must preserve / must avoid>
Intended use: <where the asset will be used>
```

If the request is already detailed, keep it detailed rather than creatively expanding it. If it is generic, add only practical composition and polish cues that materially improve the result.

## Parameters

- `prompt` is required.
- `image` accepts local file paths or HTTP(S) URLs. Never pass raw base64 or data URIs.
- `n` creates variants of one prompt, not different assets. For different assets, make separate calls.
- `size` and `quality` appear only when the fixed default model exposes them. Never force parameters absent from the schema.
- `filename` is an output prefix. Existing files are never overwritten.
- `outputDir` overrides the configured output directory for one call.

## Iteration

- Prefer one targeted change per iteration.
- Re-pass the previous saved file as `image` when iterating on it.
- Restate edit invariants to avoid drift.
- Check subject, composition, text accuracy, and preserved details after each result.

## Configuration and failure handling

- If setup is missing or invalid, tell the user to run `/image-generate settings`.
- `/image-generate list` shows configured providers/models/protocols without secrets.
- `/image-generate status` shows the active or recent task.
- Do not read settings files, request API keys, construct provider HTTP calls, or suggest that the user manually send HTTP requests. The extension owns credentials, transport, cancellation, downloads, and safe file writes.

## Reporting results

The extension opens generated images in a browser preview tab. Report every final saved path returned by the tool. Do not paste raw base64. Mention revised prompts only when returned by the provider and useful to the user.
