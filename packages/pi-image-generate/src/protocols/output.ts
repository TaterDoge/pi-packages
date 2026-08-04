import { ImageGenerateError } from "../errors.ts";
import type { RawImageResult } from "../types.ts";

const DATA_URI = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export function classifyImageReference(
  value: unknown,
  mimeType?: string,
): RawImageResult["data"] | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return { kind: "url", url: trimmed };
  const dataUri = DATA_URI.exec(trimmed);
  if (dataUri) return { kind: "base64", bytes: dataUri[2], mimeType: dataUri[1].toLowerCase() };
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length >= 8) {
    return { kind: "base64", bytes: trimmed, ...(mimeType ? { mimeType } : {}) };
  }
  return undefined;
}

export function requireImages(images: RawImageResult[], providerName: string): RawImageResult[] {
  if (images.length === 0) {
    throw new ImageGenerateError(
      `${providerName} returned no usable image data. The prompt may have been refused or the response mapping is wrong.`,
      "provider-no-images",
    );
  }
  return images;
}
