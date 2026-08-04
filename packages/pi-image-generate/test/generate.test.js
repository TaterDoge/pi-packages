import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDefaultImageGenerateSettings } from "../src/config.ts";
import { generateImage } from "../src/generate.ts";
import { GenerationTaskManager } from "../src/task-manager.ts";

const PNG_B64 = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
const dirs = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))),
);
async function temp() {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-image-generate-run-"));
  dirs.push(dir);
  return dir;
}
function settings() {
  const value = getDefaultImageGenerateSettings();
  value.defaultModel = "studio/flux";
  value.providers.studio = {
    baseUrl: "https://provider.test/v1",
    protocol: "openai-images",
    credential: { source: "env", value: "IMAGE_KEY" },
  };
  value.models["studio/flux"] = {
    provider: "studio",
    id: "flux",
    capabilities: { imageInput: "multiple", n: true, size: true, qualityValues: ["high"] },
  };
  return value;
}

describe("generateImage orchestrator", () => {
  test("resolves config, runs the protocol, saves, and completes one shared task", async () => {
    const cwd = await temp();
    process.env.IMAGE_KEY = "secret";
    const manager = new GenerationTaskManager({ id: () => "task-1" });
    const phases = [];
    manager.subscribe((task) => phases.push(task.phase));
    const result = await generateImage(
      { prompt: "a cat", filename: "cat" },
      {
        cwd,
        settings: settings(),
        modelRegistry: { getApiKeyForProvider: async () => undefined },
        taskManager: manager,
        source: "tool",
        fetchImpl: async () =>
          new Response(JSON.stringify({ data: [{ b64_json: PNG_B64 }] }), {
            headers: { "content-type": "application/json" },
          }),
      },
    );
    expect(result.taskId).toBe("task-1");
    expect(result.images[0].path).toEndWith("cat.png");
    expect(result.images[0].data).toBe(PNG_B64);
    expect(phases).toContain("preparing");
    expect(phases.at(-1)).toBe("succeeded");
  });

  test("requires a fixed configured default model", async () => {
    const cwd = await temp();
    await expect(
      generateImage(
        { prompt: "a cat" },
        {
          cwd,
          settings: getDefaultImageGenerateSettings(),
          modelRegistry: { getApiKeyForProvider: async () => undefined },
          taskManager: new GenerationTaskManager(),
          source: "command",
        },
      ),
    ).rejects.toThrow("No default image model");
  });

  test("rejects parameters that the fixed model does not expose", async () => {
    const cwd = await temp();
    const value = settings();
    value.models["studio/flux"].capabilities.size = false;
    await expect(
      generateImage(
        { prompt: "a cat", size: "1024x1024" },
        {
          cwd,
          settings: value,
          modelRegistry: { getApiKeyForProvider: async () => undefined },
          taskManager: new GenerationTaskManager(),
          source: "tool",
        },
      ),
    ).rejects.toThrow("does not expose a size");
  });
});
