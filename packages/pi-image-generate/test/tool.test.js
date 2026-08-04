import { describe, expect, test } from "bun:test";
import { getDefaultImageGenerateSettings } from "../src/config.ts";
import extension, { buildToolParameters, formatImageTaskStatus } from "../src/index.ts";

describe("dynamic image_generate tool", () => {
  test("renders active task phases with the pi-status spinner", () => {
    const task = { phase: "requesting", model: "custom/gpt-image-2" };
    expect([0, 1, 2, 3].map((frame) => formatImageTaskStatus(task, frame))).toEqual([
      "◐ image: requesting",
      "◓ image: requesting",
      "◑ image: requesting",
      "◒ image: requesting",
    ]);
  });

  test("never exposes a model parameter", () => {
    const settings = getDefaultImageGenerateSettings();
    settings.defaultModel = "p/m";
    settings.providers.p = { baseUrl: "https://example.test/v1", protocol: "openai-images" };
    settings.models["p/m"] = {
      provider: "p",
      id: "remote",
      capabilities: { imageInput: "single", n: false, size: true, qualityValues: ["high"] },
    };
    const properties = buildToolParameters(settings).properties;
    expect(properties).not.toHaveProperty("model");
    expect(properties).toHaveProperty("image");
    expect(properties).not.toHaveProperty("n");
    expect(properties).toHaveProperty("size");
    expect(properties).toHaveProperty("quality");
  });

  test("registers tool immediately and again after session settings load", async () => {
    const tools = [];
    const handlers = new Map();
    extension({
      registerTool: (tool) => tools.push(tool),
      registerCommand() {},
      registerMessageRenderer() {},
      on: (name, handler) => handlers.set(name, handler),
    });
    expect(tools[0].name).toBe("image_generate");
    const ctx = {
      cwd: "/tmp",
      ui: { setStatus() {}, setWorkingMessage() {} },
      modelRegistry: { getApiKeyForProvider: async () => undefined },
    };
    await handlers.get("session_start")({}, ctx);
    expect(tools).toHaveLength(2);
  });
});
