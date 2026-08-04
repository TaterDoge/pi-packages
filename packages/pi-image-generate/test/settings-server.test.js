import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDefaultImageGenerateSettings } from "../src/config.ts";
import { parseRemoteModels, startSettingsServer } from "../src/settings-server.ts";

const dirs = [];
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "pi-image-settings-"));
  const assets = path.join(root, "assets");
  await mkdir(assets);
  await writeFile(path.join(assets, "index.html"), "<h1>settings</h1>");
  dirs.push(root);
  const settings = getDefaultImageGenerateSettings();
  settings.providers.studio = {
    baseUrl: "https://example.test",
    protocol: "openai-images",
    credential: { source: "literal", value: "secret-value" },
  };
  const server = await startSettingsServer({
    settings,
    assetDir: assets,
    agentDir: root,
    idleTimeoutMs: 60_000,
  });
  servers.push(server);
  const first = await fetch(server.url, { redirect: "manual" });
  const cookie = first.headers.get("set-cookie").split(";", 1)[0];
  const base = new URL(first.headers.get("location"), server.url).origin;
  return { root, server, settings, cookie, base };
}

describe("browser settings server", () => {
  test("normalizes OpenAI and Gemini model lists", () => {
    expect(
      parseRemoteModels({
        data: [{ id: "gpt-image-1", name: "GPT Image" }],
      }),
    ).toEqual([{ id: "gpt-image-1", name: "GPT Image" }]);
    expect(
      parseRemoteModels({
        models: [{ name: "models/gemini-image", displayName: "Gemini Image" }],
      }),
    ).toEqual([{ id: "gemini-image", name: "Gemini Image" }]);
  });

  test("fetches provider models without exposing credentials to the browser", async () => {
    let authorization;
    const { root, settings } = await setup();
    await servers.pop()?.close();
    const discoveryServer = await startSettingsServer({
      settings,
      assetDir: path.join(root, "assets"),
      agentDir: root,
      idleTimeoutMs: 60_000,
      fetchImpl: async (_url, init) => {
        authorization = init.headers.authorization;
        return new Response(JSON.stringify({ data: [{ id: "image-model" }] }), {
          headers: { "content-type": "application/json" },
        });
      },
    });
    servers.push(discoveryServer);
    const session = await fetch(discoveryServer.url, { redirect: "manual" });
    const cookie = session.headers.get("set-cookie").split(";", 1)[0];
    const base = new URL(session.headers.get("location"), discoveryServer.url).origin;
    const draft = await (await fetch(`${base}/api/settings`, { headers: { cookie } })).json();
    expect(draft.settings.providers.studio.credential.value).not.toBe("secret-value");
    const response = await fetch(`${base}/api/models`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ providerId: "studio", settings: draft.settings }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: [{ id: "image-model" }] });
    expect(authorization).toBe("Bearer secret-value");
  });

  test("requires the one-time session and masks literal credentials", async () => {
    const { cookie, base } = await setup();
    expect((await fetch(`${base}/api/settings`)).status).toBe(403);
    const response = await fetch(`${base}/api/settings`, { headers: { cookie } });
    const body = await response.json();
    expect(body.settings.providers.studio.credential.value).not.toBe("secret-value");
  });

  test("validates, saves, and restores an unchanged masked credential", async () => {
    const { root, server, cookie, base } = await setup();
    const current = await (await fetch(`${base}/api/settings`, { headers: { cookie } })).json();
    current.settings.outputDir = "generated";
    const response = await fetch(`${base}/api/settings`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(current.settings),
    });
    expect(response.status).toBe(200);
    expect(await server.result).toBeTrue();
    const saved = JSON.parse(
      await readFile(path.join(root, "extensions/pi-image-generate/config.json"), "utf8"),
    );
    expect(saved.outputDir).toBe("generated");
    expect(saved.providers.studio.credential.value).toBe("secret-value");
  });

  test("rejects an invalid draft without writing", async () => {
    const { root, settings, cookie, base } = await setup();
    settings.outputDir = "";
    const response = await fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    expect(response.status).toBe(400);
    expect(
      await Bun.file(path.join(root, "extensions/pi-image-generate/config.json")).exists(),
    ).toBeFalse();
  });
});
