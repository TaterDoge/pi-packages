// fallow-ignore-file unused-file
import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG } from "../src/constants.ts";
import { startSettingsServer } from "../src/settings/server.ts";

const servers = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }
});

function makeServer(overrides = {}) {
  const saved = [];
  const server = startSettingsServer({
    save: (config) => {
      saved.push(config);
      return "/tmp/config.json";
    },
    payload: () => ({ config: DEFAULT_CONFIG, marker: "payload" }),
    preview: (config, width) => ({
      top: `top:${width}`,
      bottom: "bottom",
      separator: config.separator,
    }),
    assetDir: new URL("../web/dist", import.meta.url).pathname,
    idleTimeoutMs: 5_000,
    ...overrides,
  });
  return { server, saved };
}

/** Follow the token link once to collect the session cookie, then reuse it. */
async function authenticate(url) {
  const response = await fetch(url, { redirect: "manual" });
  const cookie = response.headers.get("set-cookie") ?? "";
  return cookie.split(";", 1)[0];
}

describe("startSettingsServer", () => {
  test("rejects requests without the session cookie", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const response = await fetch(new URL("/api/config", instance.url));
    expect(response.status).toBe(403);
  });

  test("rejects a wrong token", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const response = await fetch(new URL("/session?token=nope", instance.url), {
      redirect: "manual",
    });
    expect(response.status).toBe(403);
  });

  test("exchanges the token for a cookie and serves the payload", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);
    expect(cookie).toContain("pi_status_settings=");

    const response = await fetch(new URL("/api/config", instance.url), { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ marker: "payload" });
  });

  test("renders a preview from a draft config", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/preview", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ config: { ...DEFAULT_CONFIG, separator: " | " }, width: 77 }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ top: "top:77", bottom: "bottom", separator: " | " });
  });

  test("rejects a preview request whose config cannot be validated", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/preview", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ config: "not-an-object", width: 80 }),
    });
    expect(response.status).toBe(400);
  });

  test("saves a valid config and resolves the result", async () => {
    const { server, saved } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/config", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ...DEFAULT_CONFIG, separator: " :: " }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, path: "/tmp/config.json" });
    expect(await instance.result).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].separator).toBe(" :: ");
  });

  test("rejects a partial layout instead of filling it from the defaults", async () => {
    const { server, saved } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/config", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        separator: " · ",
        contextBarStyle: "blocks",
        components: [{ id: "status", enabled: true, zone: "top-left" }],
      }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(
      body.issues.some((issue) => issue.path === "components.git" && issue.message === "Missing."),
    ).toBeTrue();
    expect(saved).toHaveLength(0);
  });

  test("rejects a duplicate component id", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const components = DEFAULT_CONFIG.components.map((component) => ({ ...component }));
    components[1] = { ...components[0] };
    const response = await fetch(new URL("/api/config", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ...DEFAULT_CONFIG, components }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues.some((issue) => issue.message === "Duplicate.")).toBeTrue();
  });

  test("writes nothing when the submitted config is not an object", async () => {
    const { server, saved } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/config", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(["nope"]),
    });
    expect(response.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  test("cancel resolves the result without saving", async () => {
    const { server, saved } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/cancel", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(await instance.result).toBe(false);
    expect(saved).toHaveLength(0);
  });

  test("idle timeout resolves without saving", async () => {
    const { server, saved } = makeServer({ idleTimeoutMs: 30 });
    const instance = await server;
    servers.push(instance);
    expect(await instance.result).toBe(false);
    expect(saved).toHaveLength(0);
  });

  test("a page that leaves resolves the result after the grace period", async () => {
    const { server } = makeServer({ abandonGraceMs: 30 });
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/leave", instance.url), {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    expect(await instance.result).toBe(false);
  });

  test("a request during the grace period cancels the abandon", async () => {
    const { server } = makeServer({ abandonGraceMs: 200 });
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    await fetch(new URL("/api/leave", instance.url), { method: "POST", headers: { cookie } });
    const reload = await fetch(new URL("/api/config", instance.url), { headers: { cookie } });
    expect(reload.status).toBe(200);
    const raced = await Promise.race([instance.result, Bun.sleep(300).then(() => "still open")]);
    expect(raced).toBe("still open");
  });

  test("a stale leave beacon from a refreshed page is ignored", async () => {
    const { server } = makeServer({ abandonGraceMs: 30 });
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    // A refresh loads the new page first, then the old page's beacon lands late.
    await fetch(new URL("/api/config", instance.url), {
      headers: { cookie, "x-page-id": "new" },
    });
    await fetch(new URL("/api/leave?page=old", instance.url), {
      method: "POST",
      headers: { cookie },
    });
    const raced = await Promise.race([instance.result, Bun.sleep(120).then(() => "still open")]);
    expect(raced).toBe("still open");
  });

  test("serves the built page with a CSP header", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/", instance.url), { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  test("blocks path traversal outside the asset directory", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/../package.json", instance.url), {
      headers: { cookie },
    });
    expect(response.status).toBe(404);
  });

  test("rejects a non-JSON content type", async () => {
    const { server } = makeServer();
    const instance = await server;
    servers.push(instance);
    const cookie = await authenticate(instance.url);

    const response = await fetch(new URL("/api/config", instance.url), {
      method: "POST",
      headers: { cookie, "content-type": "text/plain" },
      body: JSON.stringify(DEFAULT_CONFIG),
    });
    expect(response.status).toBe(400);
  });
});
