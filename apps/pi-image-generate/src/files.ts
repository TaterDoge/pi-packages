import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { ImageGenerateError } from "./errors.ts";
import { sniffMime } from "./image-input.ts";
import { assertOk, fetchWithTimeout, readResponseBytes, safeHttpUrl } from "./protocols/http.ts";
import type { ImageGenerateLimits, RawImageResult } from "./types.ts";

export type MaterializedImage = {
  bytes: Uint8Array;
  mimeType: string;
  revisedPrompt?: string;
};

export async function materializeImage(
  raw: RawImageResult,
  fetchImpl: typeof fetch,
  limits: ImageGenerateLimits,
  signal?: AbortSignal,
): Promise<MaterializedImage> {
  if (raw.data.kind === "bytes") {
    enforceSize(raw.data.bytes, limits.maxImageBytes);
    return {
      bytes: raw.data.bytes,
      mimeType: raw.data.mimeType,
      ...(raw.revisedPrompt ? { revisedPrompt: raw.revisedPrompt } : {}),
    };
  }
  if (raw.data.kind === "base64") {
    const bytes = Buffer.from(raw.data.bytes, "base64");
    enforceSize(bytes, limits.maxImageBytes);
    return {
      bytes,
      mimeType: sniffMime(bytes) ?? raw.data.mimeType ?? "image/png",
      ...(raw.revisedPrompt ? { revisedPrompt: raw.revisedPrompt } : {}),
    };
  }
  const url = safeHttpUrl(raw.data.url);
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    { method: "GET", headers: { "user-agent": "pi-image-generate/0.1" } },
    limits.requestTimeoutMs,
    signal,
  );
  await assertOk(response, "Generated image host");
  const bytes = await readResponseBytes(response, limits.maxImageBytes, "Generated image");
  const mimeType =
    sniffMime(bytes) ??
    response.headers.get("content-type")?.split(";", 1)[0]?.trim() ??
    "image/png";
  return { bytes, mimeType, ...(raw.revisedPrompt ? { revisedPrompt: raw.revisedPrompt } : {}) };
}

export function resolveOutputDirectory(configured: string | undefined, cwd: string): string {
  const value = configured?.trim() || ".pi/images";
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(cwd, value);
}

export function sanitizeFilename(value: string): string {
  const base = path.basename(value.trim()).replace(/\.[A-Za-z0-9]{1,8}$/, "");
  const sanitized = Array.from(base.normalize("NFKC"), (character) =>
    character.charCodeAt(0) < 32 ? "-" : character,
  )
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return sanitized || "image";
}

export async function writeUniqueImage(
  directory: string,
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<string> {
  await mkdir(directory, { recursive: true });
  const stem = sanitizeFilename(filename);
  const extension = extensionForMime(mimeType);
  for (let version = 1; ; version++) {
    if (signal?.aborted)
      throw new ImageGenerateError("Image generation was cancelled.", "file-write-cancelled");
    const target = path.join(
      directory,
      version === 1 ? `${stem}.${extension}` : `${stem}-v${version}.${extension}`,
    );
    let created = false;
    try {
      const handle = await open(target, "wx");
      created = true;
      try {
        await handle.writeFile(bytes, { signal });
      } finally {
        await handle.close();
      }
      return target;
    } catch (error) {
      if (created) await rm(target, { force: true }).catch(() => {});
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      if (signal?.aborted || (error as Error)?.name === "AbortError") {
        throw new ImageGenerateError("Image generation was cancelled.", "file-write-cancelled");
      }
      throw new ImageGenerateError(
        "The generated image could not be written. Check the output directory and available disk space.",
        "file-write-failed",
      );
    }
  }
}

export function timestampFilename(modelKey: string, date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return sanitizeFilename(`${modelKey}-${stamp}`);
}

function enforceSize(bytes: Uint8Array, limit: number): void {
  if (bytes.byteLength > limit) {
    throw new ImageGenerateError(
      "A generated image exceeded the configured size limit.",
      "generated-image-too-large",
    );
  }
}

function extensionForMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}
