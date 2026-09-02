import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import piRememberModel, { patchSettings, settingsPath } from "../src/index.ts";

const tempDirs = [];
const savedEnv = process.env.PI_CODING_AGENT_DIR;

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
  if (savedEnv === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = savedEnv;
  }
});

function useTempAgentDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-remember-model-test-"));
  tempDirs.push(dir);
  process.env.PI_CODING_AGENT_DIR = dir;
  return dir;
}

describe("settingsPath", () => {
  test("resolves PI_CODING_AGENT_DIR when set", () => {
    const dir = useTempAgentDir();
    expect(settingsPath()).toBe(path.join(dir, "settings.json"));
  });

  test("falls back to ~/.pi/agent/settings.json", () => {
    delete process.env.PI_CODING_AGENT_DIR;
    expect(settingsPath()).toBe(path.join(homedir(), ".pi", "agent", "settings.json"));
  });
});

describe("patchSettings", () => {
  test("creates the file when missing", () => {
    const dir = useTempAgentDir();
    patchSettings({ defaultModel: "m1" });

    const written = JSON.parse(readFileSync(path.join(dir, "settings.json"), "utf8"));
    expect(written).toEqual({ defaultModel: "m1" });
  });

  test("merges into existing settings, preserving unrelated keys", () => {
    const dir = useTempAgentDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({ theme: "ayu-dark", defaultModel: "old" }),
      "utf8",
    );

    patchSettings({ defaultProvider: "anthropic", defaultModel: "m2" });

    const written = JSON.parse(readFileSync(path.join(dir, "settings.json"), "utf8"));
    expect(written).toEqual({
      theme: "ayu-dark",
      defaultProvider: "anthropic",
      defaultModel: "m2",
    });
  });

  test("starts fresh on invalid JSON instead of throwing", () => {
    const dir = useTempAgentDir();
    writeFileSync(path.join(dir, "settings.json"), "{ not json", "utf8");

    expect(() => patchSettings({ defaultModel: "m3" })).not.toThrow();
    const written = JSON.parse(readFileSync(path.join(dir, "settings.json"), "utf8"));
    expect(written).toEqual({ defaultModel: "m3" });
  });
});

describe("extension wiring", () => {
  function makeFakePi() {
    const handlers = {};
    return {
      handlers,
      on(event, handler) {
        handlers[event] = handler;
      },
    };
  }

  test("model_select writes provider and id", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.model_select({ source: "set", model: { provider: "openai", id: "gpt-5" } });

    const written = JSON.parse(readFileSync(settingsPath(), "utf8"));
    expect(written.defaultProvider).toBe("openai");
    expect(written.defaultModel).toBe("gpt-5");
  });

  test("model_select skips session restore", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.model_select({
      source: "restore",
      model: { provider: "openai", id: "gpt-5" },
    });

    expect(existsSync(settingsPath())).toBe(false);
  });

  test("thinking_level_select writes level", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.thinking_level_select({ level: "high" });

    const written = JSON.parse(readFileSync(settingsPath(), "utf8"));
    expect(written.defaultThinkingLevel).toBe("high");
  });
});
