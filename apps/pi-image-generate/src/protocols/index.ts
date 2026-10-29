import { ImageGenerateError } from "../errors.ts";
import type { ImageGenerateSettings, ImageProtocol, ProviderConfig } from "../types.ts";
import { geminiGenerateContentProtocol } from "./gemini-generate-content.ts";
import { createGenericJsonProtocol } from "./generic-json.ts";
import { openAiImagesProtocol } from "./openai-images.ts";

export function resolveProtocol(
  provider: ProviderConfig,
  settings: ImageGenerateSettings,
): ImageProtocol {
  if (provider.protocol === "openai-images") return openAiImagesProtocol;
  if (provider.protocol === "gemini-generate-content") return geminiGenerateContentProtocol;
  const custom = settings.protocols[provider.protocol];
  if (custom) return createGenericJsonProtocol(custom);
  throw new ImageGenerateError(
    `Provider protocol "${provider.protocol}" is not configured. Open /image-generate settings.`,
    "provider-protocol-missing",
  );
}
