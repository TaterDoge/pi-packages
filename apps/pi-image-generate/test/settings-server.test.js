import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDefaultImageGenerateSettings } from "../src/config.ts";
import { createImageGenerateDescriptor } from "../src/descriptor.ts";
import { parseRemoteModels } from "../src/model-discovery.ts";
import { startSettingsServer } from "../src/settings/server.ts";

const dirs = [];
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-image-settings-"));
  const assets = path.join(root, "assets");
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, "index.html"), "<h1>settings</h1>");
  dirs.push(root);
  const settings = getDefaultImageGenerateSettings();
  settings.providers.studio = {
    baseUrl: "https://example.test",
    protocol: "openai-images",
    credential: { source: "literal", value: "secret-value" },
  };
  const descriptor = createImageGenerateDescriptor({
    agentDir: root,
    modelRegistry: options.modelRegistry,
    fetchImpl: options.fetchImpl,
  });
  const server = await startSettingsServer({
    descriptor: {
      ...descriptor,
      load: async () => settings,
    },
    assetDir: assets,
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
    expect(parseRemoteModels({ data: [{ id: "gpt-image-1", name: "GPT Image" }] })).toEqual([
      { id: "gpt-image-1", name: "GPT Image" },
    ]);
    expect(
      parseRemoteModels({ models: [{ name: "models/gemini-image", displayName: "Gemini Image" }] }),
    ).toEqual([{ id: "gemini-image", name: "Gemini Image" }]);
  });

  test("requires the one-time session and masks literal credentials", async () => {
    const { cookie, base } = await setup();
    expect((await fetch(`${base}/api/settings`)).status).toBe(403);
    const response = await fetch(`${base}/api/settings`, { headers: { cookie } });
    const body = await response.json();
    expect(body.settings.providers.studio.credential.value).not.toBe("secret-value");
  });

  test("describes the page from the descriptor", async () => {
    const { cookie, base } = await setup();
    const meta = await (await fetch(`${base}/api/meta`, { headers: { cookie } })).json();
    expect(meta.id).toBe("pi-image-generate");
    expect(meta.ui.sections.map((section) => section.id)).toEqual([
      "general",
      "providers",
      "models",
      "protocols",
    ]);
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
    const { root, cookie, base } = await setup();
    const response = await fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ...getDefaultImageGenerateSettings(), outputDir: "" }),
    });
    expect(response.status).toBe(400);
    expect(
      await Bun.file(path.join(root, "extensions/pi-image-generate/config.json")).exists(),
    ).toBeFalse();
  });

  test("cascades provider deletion to its models and the default", async () => {
    const { cookie, base } = await setup();
    const current = await (await fetch(`${base}/api/settings`, { headers: { cookie } })).json();
    current.settings.models = {
      "studio-image": {
        provider: "studio",
        id: "image-1",
        capabilities: { imageInput: "none", n: false, size: false, qualityValues: [] },
      },
    };
    current.settings.defaultModel = "studio-image";
    const response = await fetch(`${base}/api/delete-record`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ draft: current.settings, path: "providers", id: "studio" }),
    });
    expect(response.status).toBe(200);
    const next = (await response.json()).settings;
    expect(next.providers.studio).toBeUndefined();
    expect(next.models["studio-image"]).toBeUndefined();
    expect(next.defaultModel).toBeUndefined();
  });

  test("runs a descriptor action against the draft without exposing credentials", async () => {
    let authorization;
    const { cookie, base } = await setup({
      fetchImpl: async (_url, init) => {
        authorization = init.headers.authorization;
        return new Response(JSON.stringify({ data: [{ id: "image-model" }] }), {
          headers: { "content-type": "application/json" },
        });
      },
    });
    const current = await (await fetch(`${base}/api/settings`, { headers: { cookie } })).json();
    expect(current.settings.providers.studio.credential.value).not.toBe("secret-value");
    const response = await fetch(`${base}/api/action`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        action: "discover-models",
        draft: current.settings,
        args: { providerId: "studio" },
      }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ models: [{ id: "image-model" }] });
    expect(authorization).toBe("Bearer secret-value");
  });
});
