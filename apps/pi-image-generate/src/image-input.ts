import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageGenerateError } from "./errors.ts";
import { assertOk, fetchWithTimeout, readResponseBytes, safeHttpUrl } from "./protocols/http.ts";
import type { ImageGenerateLimits, ResolvedImageInput } from "./types.ts";

const DATA_URI = /^data:/i;

export async function resolveImageInputs(
  values: string[] | undefined,
  cwd: string,
  fetchImpl: typeof fetch,
  limits: ImageGenerateLimits,
  signal?: AbortSignal,
): Promise<ResolvedImageInput[]> {
  if (!values?.length) return [];
  if (values.length > limits.maxInputImages) {
    throw new ImageGenerateError(
      `At most ${limits.maxInputImages} input images are allowed.`,
      "too-many-input-images",
    );
  }
  const output: ResolvedImageInput[] = [];
  for (const value of values) output.push(await resolveOne(value, cwd, fetchImpl, limits, signal));
  return output;
}

async function resolveOne(
  raw: string,
  cwd: string,
  fetchImpl: typeof fetch,
  limits: ImageGenerateLimits,
  signal?: AbortSignal,
): Promise<ResolvedImageInput> {
  const value = raw.trim();
  if (!value) throw new ImageGenerateError("An input image is empty.", "input-image-empty");
  if (DATA_URI.test(value) || (value.length > 256 && /^[A-Za-z0-9+/=]+$/.test(value))) {
    throw new ImageGenerateError(
      "Input images must be file paths or HTTP(S) URLs, not raw base64 or data URIs.",
      "input-image-inline-rejected",
    );
  }
  if (/^https?:\/\//i.test(value)) {
    const url = safeHttpUrl(value);
    const response = await fetchWithTimeout(
      fetchImpl,
      url,
      { method: "GET", headers: { "user-agent": "pi-image-generate/0.1" } },
      limits.requestTimeoutMs,
      signal,
    );
    await assertOk(response, "Input image host");
    const bytes = await readResponseBytes(response, limits.maxImageBytes, "Input image");
    const mimeType =
      sniffMime(bytes) ?? cleanMime(response.headers.get("content-type")) ?? "image/png";
    return { bytes, mimeType, sourceUrl: url };
  }
  const absolute = path.isAbsolute(value) ? value : path.resolve(cwd, value);
  let bytes: Uint8Array;
  try {
    const file = await readFile(absolute);
    if (file.byteLength > limits.maxImageBytes) {
      throw new ImageGenerateError(
        "An input image exceeded the configured size limit.",
        "input-image-too-large",
      );
    }
    bytes = file;
  } catch (error) {
    if (error instanceof ImageGenerateError) throw error;
    throw new ImageGenerateError(
      "An input image is not a readable file path or HTTP(S) URL.",
      "input-image-unreadable",
    );
  }
  return { bytes, mimeType: sniffMime(bytes) ?? mimeFromExtension(absolute) ?? "image/png" };
}

export function sniffMime(bytes: Uint8Array): string | undefined {
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    starts(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function starts(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

function cleanMime(value: string | null): string | undefined {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  return mime?.startsWith("image/") ? mime : undefined;
}

function mimeFromExtension(value: string): string | undefined {
  switch (path.extname(value).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return undefined;
  }
}
