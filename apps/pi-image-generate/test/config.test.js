import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getDefaultImageGenerateSettings,
  loadImageGenerateSettings,
  validateImageGenerateSettings,
  writeImageGenerateSettings,
} from "../src/config.ts";

const dirs = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-image-generate-config-"));
  dirs.push(dir);
  return dir;
}

function validSettings() {
  const settings = getDefaultImageGenerateSettings();
  settings.defaultModel = "studio/flux";
  settings.providers.studio = {
    baseUrl: "https://gateway.example/v1",
    protocol: "openai-images",
    credential: { source: "env", value: "IMAGE_KEY" },
  };
  settings.models["studio/flux"] = {
    provider: "studio",
    id: "vendor/flux",
    capabilities: { imageInput: "multiple", n: true, size: true, qualityValues: [] },
  };
  return settings;
}

describe("image generation config", () => {
  test("accepts a complete v1 configuration", () => {
    const result = validateImageGenerateSettings(validSettings());
    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.settings.defaultModel).toBe("studio/flux");
  });

  test("accepts a directly stored credential and rejects legacy commands", () => {
    const settings = validSettings();
    settings.providers.studio.credential = { source: "literal", value: "secret-value" };
    expect(validateImageGenerateSettings(settings).ok).toBeTrue();
    settings.providers.studio.credential = { source: "command", value: "!echo secret" };
    expect(validateImageGenerateSettings(settings).ok).toBeFalse();
  });

  test("rejects missing references, invalid URLs, and unknown fields", () => {
    const settings = validSettings();
    settings.providers.studio.baseUrl = "file:///secret";
    settings.models["studio/flux"].provider = "missing";
    settings.extra = true;
    const result = validateImageGenerateSettings(settings);
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      const text = result.issues.map((entry) => `${entry.path} ${entry.message}`).join("\n");
      expect(text).toContain("baseUrl");
      expect(text).toContain("unknown provider");
      expect(text).toContain("extra");
    }
  });

  test("loads settings from standalone config.json", async () => {
    const dir = await tempDir();
    const configDir = path.join(dir, "extensions", "pi-image-generate");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.json"), JSON.stringify(validSettings()));
    const result = await loadImageGenerateSettings(dir);
    expect(result.ok).toBeTrue();
    expect(result.settings.defaultModel).toBe("studio/flux");
  });

  test("atomically writes standalone config.json", async () => {
    const dir = await tempDir();
    const configDir = path.join(dir, "extensions", "pi-image-generate");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, "config.json");
    await writeFile(configPath, JSON.stringify(getDefaultImageGenerateSettings()));
    await writeImageGenerateSettings(validSettings(), dir);
    const data = JSON.parse(await readFile(configPath, "utf8"));
    expect(data.defaultModel).toBe("studio/flux");
    expect(data.version).toBe(1);
  });

  test("handles missing config.json gracefully", async () => {
    const dir = await tempDir();
    const result = await loadImageGenerateSettings(dir);
    expect(result.ok).toBeTrue();
    expect(result.settings.version).toBe(1);
  });

  test("rejects malformed config.json", async () => {
    const dir = await tempDir();
    const configDir = path.join(dir, "extensions", "pi-image-generate");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.json"), "{broken");
    const result = await loadImageGenerateSettings(dir);
    expect(result.ok).toBeFalse();
  });
});
