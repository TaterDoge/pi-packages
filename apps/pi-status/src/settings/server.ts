import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePiStatusConfig } from "../config.ts";
import { ALL_COMPONENT_IDS } from "../constants.ts";
import type { ComponentId, PiStatusConfig } from "../types.ts";
import type { ConfigIssue } from "./protocol.ts";

const MAX_BODY_BYTES = 256 * 1024;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
/** Grace after the page unloads: a reload sends /api/leave too, then fetches again. */
const ABANDON_GRACE_MS = 1500;

export type SettingsServerOptions = {
  /** Persist a validated config. Return the path that was written so the page can show it. */
  save: (config: PiStatusConfig) => string | undefined;
  /** Rendered payload for the initial page load. */
  payload: () => unknown;
  /** Border preview for a draft config at a given width. */
  preview: (config: PiStatusConfig, width: number) => unknown;
  assetDir?: string;
  idleTimeoutMs?: number;
  abandonGraceMs?: number;
};

export type SettingsServer = {
  url: string;
  /** Resolves true when the page saved, false on cancel or idle timeout. */
  result: Promise<boolean>;
  close: () => Promise<void>;
};

export async function startSettingsServer(options: SettingsServerOptions): Promise<SettingsServer> {
  const token = randomBytes(32).toString("base64url");
  const assetDir = options.assetDir ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  const cookieName = "pi_status_settings";

  let finish: (saved: boolean) => void = () => {};
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  let abandonTimer: ReturnType<typeof setTimeout> | undefined;
  let savedPath: string | undefined;
  // This is the most recent page instance that talked to us. A refresh loads the new page
  // before the old one's /api/leave beacon lands, so the beacon must not count as a leave.
  let activePageId: string | undefined;
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
          "set-cookie": `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
          "cache-control": "no-store",
        });
        response.end();
        return;
      }
      if (!authorized(request, cookieName, token)) return send(response, 403, "Forbidden");
      if (url.pathname === "/api/leave" && request.method === "POST") {
        json(response, 200, { ok: true });
        const leaving = url.searchParams.get("page") ?? headerPageId(request);
        if (!leaving || leaving === activePageId) abandonSoon();
        return;
      }
      activePageId = headerPageId(request) ?? activePageId;
      resetTimer();

      if (url.pathname === "/api/config" && request.method === "GET") {
        return json(response, 200, options.payload());
      }
      if (url.pathname === "/api/preview" && request.method === "POST") {
        const body = (await readJson(request)) as { config?: unknown; width?: unknown };
        const draft = decodeConfig(body.config);
        if (!draft) return json(response, 400, { error: "Configuration is invalid." });
        const width =
          typeof body.width === "number" && Number.isFinite(body.width) ? body.width : 120;
        return json(response, 200, options.preview(draft, width));
      }
      if (url.pathname === "/api/config" && request.method === "POST") {
        const record = asRecord(await readJson(request));
        // The page always submits every module; anything else would let validation fill the gaps
        // from the defaults and silently undo the user's layout.
        const issues = submissionIssues(record);
        if (issues.length > 0)
          return json(response, 400, { error: "Configuration is invalid.", issues });
        const draft = record ? validatePiStatusConfig(record) : null;
        if (!draft) return json(response, 400, { error: "Configuration is invalid." });
        const written = options.save(draft);
        savedPath = typeof written === "string" ? written : savedPath;
        json(response, 200, { ok: true, path: savedPath });
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
    // Any live request, including the page's own reload, cancels a pending abandon.
    clearTimeout(abandonTimer);
    timer = setTimeout(() => settle(false), options.idleTimeoutMs ?? IDLE_TIMEOUT_MS);
    timer.unref();
  }

  function abandonSoon() {
    if (settled) return;
    clearTimeout(abandonTimer);
    abandonTimer = setTimeout(() => settle(false), options.abandonGraceMs ?? ABANDON_GRACE_MS);
    abandonTimer.unref();
  }

  function settle(saved: boolean) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(abandonTimer);
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
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Keep-alive sockets from a page that is still open would otherwise stall the close.
        server.closeAllConnections();
      });
    },
  };
}

/** Every module must be present exactly once, and no unknown id may sneak in. */
function submissionIssues(record: Record<string, unknown> | undefined): ConfigIssue[] {
  if (!record) return [{ path: "config", message: "Configuration must be an object." }];
  if (!Array.isArray(record.components))
    return [{ path: "components", message: "Components must be a list." }];

  const counts = new Map<string, number>();
  for (const item of record.components) {
    const id = asRecord(item)?.id;
    if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const issues: ConfigIssue[] = [];
  for (const id of ALL_COMPONENT_IDS) {
    const count = counts.get(id) ?? 0;
    if (count === 0) issues.push({ path: `components.${id}`, message: "Missing." });
    else if (count > 1) issues.push({ path: `components.${id}`, message: "Duplicate." });
  }
  for (const id of counts.keys()) {
    if (!ALL_COMPONENT_IDS.includes(id as ComponentId))
      issues.push({ path: `components.${id}`, message: "Unknown component id." });
  }
  return issues;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Identifies the page instance that sent the request, so a stale beacon can be told apart. */
function headerPageId(request: IncomingMessage): string | undefined {
  const value = request.headers["x-page-id"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Reject anything that is not a plain object before validating: validatePiStatusConfig fills
 * missing components from the defaults, so `{}` would silently wipe the user's layout.
 */
function decodeConfig(value: unknown): PiStatusConfig | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return validatePiStatusConfig(record) ?? undefined;
}

export async function openBrowser(url: string): Promise<boolean> {
  let command = "xdg-open";
  let args = [url];
  if (process.platform === "darwin") command = "open";
  else if (process.platform === "win32") {
    command = "rundll32";
    args = ["url.dll,FileProtocolHandler", url];
  }
  try {
    const { spawn } = await import("node:child_process");
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
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
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
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

function authorized(request: IncomingMessage, cookieName: string, token: string): boolean {
  const cookies = Object.fromEntries(
    (request.headers.cookie ?? "").split(";").flatMap((part) => {
      const index = part.indexOf("=");
      return index < 0 ? [] : [[part.slice(0, index).trim(), part.slice(index + 1).trim()]];
    }),
  );
  return safeEqual(cookies[cookieName] ?? "", token);
}

function safeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
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
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
