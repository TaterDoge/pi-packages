import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateImageGenerateSettings, writeImageGenerateSettings } from "./config.ts";
import {
  type PiCredentialResolver,
  resolveCredential,
  resolveHeaderReferences,
} from "./credentials.ts";
import { openBrowser } from "./image-preview.ts";
import { fetchWithTimeout, joinUrl, readJsonResponse } from "./protocols/http.ts";
import type { CredentialReference, ImageGenerateSettings, ProviderConfig } from "./types.ts";

const MAX_BODY_BYTES = 1024 * 1024;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const MASKED_SECRET = "••••••••";

export type SettingsServer = {
  url: string;
  result: Promise<boolean>;
  close: () => Promise<void>;
};

type SettingsServerOptions = {
  settings: ImageGenerateSettings;
  modelRegistry?: PiCredentialResolver;
  fetchImpl?: typeof fetch;
  assetDir?: string;
  agentDir?: string;
  idleTimeoutMs?: number;
};

export type RemoteModel = {
  id: string;
  name?: string;
  description?: string;
};

// ponytail: one short-lived server keeps auth, lifecycle, and persistence together; split routing only if more endpoints are added.
export async function startSettingsServer(options: SettingsServerOptions): Promise<SettingsServer> {
  const token = randomBytes(32).toString("base64url");
  const assetDir = options.assetDir ?? fileURLToPath(new URL("../web/dist", import.meta.url));
  let finish: (saved: boolean) => void = () => {};
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<boolean>((resolve) => {
    finish = resolve;
  });

  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? "127.0.0.1";
      const url = new URL(request.url ?? "/", `http://${host}`);
      if (url.pathname === "/session" && url.searchParams.has("token")) {
        if (!safeEqual(url.searchParams.get("token") ?? "", token))
          return send(response, 403, "Forbidden");
        response.writeHead(302, {
          location: "/",
          "set-cookie": `pi_image_settings=${token}; HttpOnly; SameSite=Strict; Path=/`,
          "cache-control": "no-store",
        });
        response.end();
        return;
      }
      if (!authorized(request, token)) return send(response, 403, "Forbidden");
      resetTimer();

      if (url.pathname === "/api/settings" && request.method === "GET") {
        return json(response, 200, { settings: maskSecrets(options.settings) });
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const draft = restoreMaskedSecrets(await readJson(request), options.settings);
        const validated = validateImageGenerateSettings(draft);
        return validated.ok
          ? json(response, 200, { ok: true })
          : json(response, 400, { error: "Configuration is invalid.", issues: validated.issues });
      }
      if (url.pathname === "/api/models" && request.method === "POST")
        return handleModelDiscovery(request, response, options);
      if (url.pathname === "/api/settings" && request.method === "POST") {
        const draft = restoreMaskedSecrets(await readJson(request), options.settings);
        const validated = validateImageGenerateSettings(draft);
        if (!validated.ok)
          return json(response, 400, {
            error: "Configuration is invalid.",
            issues: validated.issues,
          });
        await writeImageGenerateSettings(validated.settings, options.agentDir);
        json(response, 200, { ok: true });
        settle(true);
        return;
      }
      if (url.pathname === "/api/cancel" && request.method === "POST") {
        json(response, 200, { ok: true });
        settle(false);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD")
        return send(response, 405, "Method not allowed");
      await serveAsset(response, assetDir, url.pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      json(response, message === "Request body is too large." ? 413 : 400, { error: message });
    }
  });

  function resetTimer() {
    clearTimeout(timer);
    timer = setTimeout(() => settle(false), options.idleTimeoutMs ?? IDLE_TIMEOUT_MS);
    timer.unref();
  }

  function settle(saved: boolean) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    finish(saved);
    setTimeout(() => server.close(), 250).unref();
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  resetTimer();
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start settings server.");
  return {
    url: `http://127.0.0.1:${address.port}/session?token=${token}`,
    result,
    close: async () => {
      settle(false);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function handleModelDiscovery(
  request: IncomingMessage,
  response: ServerResponse,
  options: SettingsServerOptions,
): Promise<void> {
  const body = (await readJson(request)) as { providerId?: unknown; settings?: unknown };
  const draft = restoreMaskedSecrets(body.settings, options.settings);
  const validated = validateImageGenerateSettings(draft);
  if (!validated.ok) {
    json(response, 400, { error: "Configuration is invalid.", issues: validated.issues });
    return;
  }
  const providerId = typeof body.providerId === "string" ? body.providerId : "";
  const provider = validated.settings.providers[providerId];
  if (!provider) {
    json(response, 404, { error: "Provider was not found." });
    return;
  }
  const models = await discoverProviderModels({
    providerId,
    provider,
    settings: validated.settings,
    modelRegistry: options.modelRegistry ?? { getApiKeyForProvider: async () => undefined },
    fetchImpl: options.fetchImpl ?? fetch,
  });
  json(response, 200, { models });
}

export async function discoverProviderModels(options: {
  providerId: string;
  provider: ProviderConfig;
  settings: ImageGenerateSettings;
  modelRegistry: PiCredentialResolver;
  fetchImpl?: typeof fetch;
}): Promise<RemoteModel[]> {
  const { providerId, provider, settings, modelRegistry, fetchImpl = fetch } = options;
  const [apiKey, headers] = await Promise.all([
    resolveCredential(provider.credential, providerId, modelRegistry),
    resolveHeaderReferences(provider.headers, providerId, modelRegistry),
  ]);
  const requestHeaders: Record<string, string> = { ...headers, accept: "application/json" };
  if (apiKey) {
    if (provider.protocol === "gemini-generate-content") requestHeaders["x-goog-api-key"] = apiKey;
    else requestHeaders.authorization = `Bearer ${apiKey}`;
  }
  const response = await fetchWithTimeout(
    fetchImpl,
    joinUrl(provider.baseUrl, "models"),
    { method: "GET", headers: requestHeaders },
    settings.limits.requestTimeoutMs,
  );
  const payload = await readJsonResponse(response, settings.limits, provider.name ?? providerId);
  return parseRemoteModels(payload);
}

export function parseRemoteModels(payload: unknown): RemoteModel[] {
  const root = record(payload);
  let entries: unknown[] = [];
  if (Array.isArray(root?.data)) entries = root.data;
  else if (Array.isArray(root?.models)) entries = root.models;
  const output = new Map<string, RemoteModel>();
  for (const entry of entries) {
    const value = record(entry);
    const explicitId = stringValue(value?.id);
    const rawId = explicitId ?? stringValue(value?.name);
    if (!rawId) continue;
    const id = rawId.replace(/^models\//, "");
    const name =
      stringValue(value?.displayName) ??
      stringValue(value?.display_name) ??
      (explicitId ? stringValue(value?.name) : undefined);
    output.set(id, {
      id,
      ...(name ? { name } : {}),
      ...(stringValue(value?.description) ? { description: stringValue(value?.description) } : {}),
    });
  }
  return [...output.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function openSettingsBrowser(url: string): void {
  void openBrowser(url);
}

async function serveAsset(response: ServerResponse, assetDir: string, pathname: string) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(assetDir, relative);
  if (!filePath.startsWith(`${path.resolve(assetDir)}${path.sep}`))
    return send(response, 404, "Not found");
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control":
        relative === "index.html" ? "no-store" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(body);
  } catch {
    send(response, 404, "Not found");
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0];
  if (contentType !== "application/json") throw new Error("Content-Type must be application/json.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body contains invalid JSON.");
  }
}

function authorized(request: IncomingMessage, token: string): boolean {
  const cookies = Object.fromEntries(
    (request.headers.cookie ?? "").split(";").flatMap((part) => {
      const index = part.indexOf("=");
      return index < 0 ? [] : [[part.slice(0, index).trim(), part.slice(index + 1).trim()]];
    }),
  );
  return safeEqual(cookies.pi_image_settings ?? "", token);
}

function safeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function maskSecrets(settings: ImageGenerateSettings): ImageGenerateSettings {
  const copy = structuredClone(settings);
  for (const provider of Object.values(copy.providers)) {
    provider.credential = maskReference(provider.credential);
    provider.headers = provider.headers?.map((header) => ({
      ...header,
      value:
        header.value.source === "literal"
          ? { source: "literal", value: MASKED_SECRET }
          : header.value,
    }));
  }
  return copy;
}

function restoreMaskedSecrets(raw: unknown, original: ImageGenerateSettings): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const copy = structuredClone(raw) as Partial<ImageGenerateSettings>;
  if (!copy.providers || typeof copy.providers !== "object") return copy;
  for (const [id, provider] of Object.entries(copy.providers)) {
    const current = original.providers[id];
    if (provider.credential?.source === "literal" && provider.credential.value === MASKED_SECRET)
      provider.credential =
        current?.credential?.source === "literal" ? current.credential : provider.credential;
    provider.headers = provider.headers?.map((header) => {
      const existing = current?.headers?.find(
        (candidate) => candidate.name.toLowerCase() === header.name.toLowerCase(),
      );
      return header.value.source === "literal" &&
        header.value.value === MASKED_SECRET &&
        existing?.value.source === "literal"
        ? { ...header, value: existing.value }
        : header;
    });
  }
  return copy;
}

function maskReference(reference?: CredentialReference): CredentialReference | undefined {
  return reference?.source === "literal" ? { source: "literal", value: MASKED_SECRET } : reference;
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function send(response: ServerResponse, status: number, value: string) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(value);
}

function contentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
