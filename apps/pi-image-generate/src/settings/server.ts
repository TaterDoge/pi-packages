import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maskPaths, restoreMasked } from "./path.ts";
import type {
  ConfigIssue,
  SettingsDescriptor,
  SettingsServer,
  SettingsServerOptions,
  SettingsValue,
} from "./types.ts";

const MAX_BODY_BYTES = 1024 * 1024;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const MASK = "••••••••";

export async function startSettingsServer<T>(
  options: SettingsServerOptions<T>,
): Promise<SettingsServer> {
  const { descriptor } = options;
  const token = randomBytes(32).toString("base64url");
  const assetDir = options.assetDir ?? fileURLToPath(new URL("../web/dist", import.meta.url));
  const cookieName = `${descriptor.id.replace(/[^a-z0-9]/gi, "_")}_settings`;
  const secrets = descriptor.secrets ?? [];

  // SAFETY: SettingsDescriptor<T> is generic over the extension's own tree; this server only
  // moves it through opaque JSON, and descriptor.validate is what gives it real shape back.
  const original = (await descriptor.load()) as unknown as SettingsValue;
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
          "set-cookie": `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`,
          "cache-control": "no-store",
        });
        response.end();
        return;
      }
      if (!authorized(request, cookieName, token)) return send(response, 403, "Forbidden");
      resetTimer();

      if (url.pathname === "/api/meta" && request.method === "GET") {
        return json(response, 200, {
          id: descriptor.id,
          title: descriptor.title,
          subtitle: descriptor.subtitle,
          icon: descriptor.icon,
          ui: descriptor.ui,
          actions: Object.keys(descriptor.actions ?? {}),
        });
      }
      if (url.pathname === "/api/settings" && request.method === "GET") {
        return json(response, 200, { settings: maskPaths(original, secrets, MASK) });
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const draft = restoreMasked(await readJson(request), original, secrets, MASK);
        const validated = validate(descriptor, draft);
        return validated.ok
          ? json(response, 200, { ok: true })
          : json(response, 400, invalid(validated.issues));
      }
      if (url.pathname === "/api/settings" && request.method === "POST") {
        const draft = restoreMasked(await readJson(request), original, secrets, MASK);
        const validated = validate(descriptor, draft);
        if (!validated.ok) return json(response, 400, invalid(validated.issues));
        await descriptor.save(validated.value);
        json(response, 200, { ok: true });
        settle(true);
        return;
      }
      if (url.pathname === "/api/delete-record" && request.method === "POST") {
        if (!descriptor.onDeleteRecordItem) return json(response, 404, { error: "Not supported." });
        const body = (await readJson(request)) as { draft?: unknown; path?: unknown; id?: unknown };
        const draft = restoreMasked(body.draft as SettingsValue, original, secrets, MASK);
        const validated = validate(descriptor, draft);
        if (!validated.ok) return json(response, 400, invalid(validated.issues));
        const recordPath = typeof body.path === "string" ? body.path : "";
        const id = typeof body.id === "string" ? body.id : "";
        const next = descriptor.onDeleteRecordItem(validated.value, recordPath, id);
        return json(response, 200, { settings: maskPaths(asTree(next), secrets, MASK) });
      }
      if (url.pathname === "/api/action" && request.method === "POST") {
        const body = (await readJson(request)) as {
          action?: unknown;
          draft?: unknown;
          args?: unknown;
        };
        const name = typeof body.action === "string" ? body.action : "";
        const action = descriptor.actions?.[name];
        if (!action) return json(response, 404, { error: "Unknown action." });
        const draft = restoreMasked(body.draft as SettingsValue, original, secrets, MASK);
        const validated = validate(descriptor, draft);
        if (!validated.ok) return json(response, 400, invalid(validated.issues));
        // `args` comes from the page (a selector); `runtime` stays server-side so the
        // browser can never inject a credential resolver or a filesystem root.
        const data = await action(validated.value, {
          args: body.args,
          runtime: options.runtime,
        });
        return json(response, 200, { data: data ?? null });
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

type Validation<T> = { ok: true; value: T } | { ok: false; issues: ConfigIssue[] };

/**
 * SAFETY: an extension's settings tree is generic (`T`) to its own descriptor, but this server
 * only ever moves it through opaque JSON. `descriptor.validate` is what gives it shape back.
 */
function asTree(value: unknown): SettingsValue {
  return value as SettingsValue;
}

function validate<T>(descriptor: SettingsDescriptor<T>, draft: SettingsValue): Validation<T> {
  if (!descriptor.validate) return { ok: true, value: draft as T };
  return descriptor.validate(draft);
}

function invalid(issues: ConfigIssue[]) {
  return { error: "Configuration is invalid.", issues };
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

async function readJson(request: IncomingMessage): Promise<SettingsValue> {
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
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as SettingsValue;
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
