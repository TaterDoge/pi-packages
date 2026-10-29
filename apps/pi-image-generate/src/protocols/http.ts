import { ImageGenerateError, redactUrl } from "../errors.ts";
import type { ImageGenerateLimits } from "../types.ts";

export function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return safeHttpUrl(endpoint);
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return safeHttpUrl(new URL(endpoint.replace(/^\//, ""), base).toString());
}

export function safeHttpUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new ImageGenerateError(
      "The configured provider endpoint is not a safe HTTP(S) URL.",
      "provider-url-invalid",
    );
  }
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, redirect: "manual", signal: controller.signal });
  } catch {
    if (externalSignal?.aborted) {
      throw new ImageGenerateError("Image generation was cancelled.", "request-cancelled");
    }
    if (controller.signal.aborted) {
      throw new ImageGenerateError("The image provider request timed out.", "request-timeout");
    }
    throw new ImageGenerateError(
      "The image provider could not be reached.",
      "request-network-error",
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

export async function assertOk(response: Response, providerName: string): Promise<void> {
  if (response.ok) return;
  await response.body?.cancel().catch(() => {});
  const status = response.status;
  const name = providerName || "Image provider";
  if (status === 401 || status === 403) {
    throw new ImageGenerateError(
      `${name} rejected its configured credential (HTTP ${status}).`,
      "provider-auth-error",
    );
  }
  if (status === 404) {
    throw new ImageGenerateError(
      `${name} returned HTTP 404. Verify the endpoint and model id.`,
      "provider-not-found",
    );
  }
  if (status === 429) {
    throw new ImageGenerateError(
      `${name} rate-limited the image request (HTTP 429).`,
      "provider-rate-limit",
    );
  }
  if (status >= 500) {
    throw new ImageGenerateError(
      `${name} had a server-side failure (HTTP ${status}).`,
      "provider-server-error",
    );
  }
  throw new ImageGenerateError(
    `${name} rejected the image request (HTTP ${status}).`,
    "provider-request-error",
  );
}

export async function readResponseBytes(
  response: Response,
  limit: number,
  label: string,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => {});
    throw new ImageGenerateError(
      `${label} exceeded the configured size limit.`,
      "response-too-large",
    );
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new ImageGenerateError(
          `${label} exceeded the configured size limit.`,
          "response-too-large",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readJsonResponse(
  response: Response,
  limits: ImageGenerateLimits,
  providerName: string,
): Promise<unknown> {
  await assertOk(response, providerName);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    await response.body?.cancel().catch(() => {});
    throw new ImageGenerateError(
      `${providerName} returned a non-JSON response from ${redactUrl(response.url || "<url>")}.`,
      "provider-response-not-json",
    );
  }
  const bytes = await readResponseBytes(response, limits.maxResponseBytes, "Provider response");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ImageGenerateError(
      `${providerName} returned invalid JSON.`,
      "provider-response-invalid-json",
    );
  }
}
