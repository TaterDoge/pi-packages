import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import piRememberModel, {
  hasCliModelSelection,
  modelsPath,
  patchSettings,
  rememberedModel,
  rememberModel,
  settingsPath,
} from "../src/index.ts";

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

function readSettingsFile() {
  return JSON.parse(readFileSync(settingsPath(), "utf8"));
}

function legacyPath() {
  return path.join(path.dirname(modelsPath()), "thinking-levels.json");
}

/** The extension only registers handlers before `session_start`, so `on` is all it needs. */
function makeFakePi() {
  return { on() {} };
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

    expect(readSettingsFile()).toEqual({ defaultModel: "m1" });
    expect(existsSync(path.join(dir, "settings.json"))).toBe(true);
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

    expect(readSettingsFile()).toEqual({
      theme: "ayu-dark",
      defaultProvider: "anthropic",
      defaultModel: "m2",
    });
  });

  test("merges object values one level deep", () => {
    const dir = useTempAgentDir();
    writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({ extra: { keep: true } }),
      "utf8",
    );

    patchSettings({ extra: { added: true } });

    expect(readSettingsFile().extra).toEqual({ keep: true, added: true });
  });

  test("merges one modelThinkingLevels entry without dropping the others", () => {
    const dir = useTempAgentDir();
    writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({ modelThinkingLevels: { "xai/grok-4.6": "xhigh" } }),
      "utf8",
    );

    patchSettings({ modelThinkingLevels: { "openai/gpt-5": "low" } });

    expect(readSettingsFile().modelThinkingLevels).toEqual({
      "xai/grok-4.6": "xhigh",
      "openai/gpt-5": "low",
    });
  });

  test("starts fresh on invalid JSON instead of throwing", () => {
    const dir = useTempAgentDir();
    writeFileSync(path.join(dir, "settings.json"), "{ not json", "utf8");

    expect(() => patchSettings({ defaultModel: "m3" })).not.toThrow();
    expect(readSettingsFile()).toEqual({ defaultModel: "m3" });
  });
});

describe("legacy thinking-levels.json migration", () => {
  function writeLegacy(data) {
    mkdirSync(path.dirname(legacyPath()), { recursive: true });
    writeFileSync(legacyPath(), typeof data === "string" ? data : JSON.stringify(data), "utf8");
  }

  test("folds the old cache into modelThinkingLevels and deletes the file", () => {
    useTempAgentDir();
    writeLegacy({ "xai/grok-4.6": "xhigh", "openai/gpt-5": "low" });

    piRememberModel(makeFakePi());

    expect(readSettingsFile().modelThinkingLevels).toEqual({
      "xai/grok-4.6": "xhigh",
      "openai/gpt-5": "low",
    });
    expect(existsSync(legacyPath())).toBe(false);
  });

  test("keeps a level already re-picked since the upgrade", () => {
    useTempAgentDir();
    writeFileSync(
      settingsPath(),
      JSON.stringify({ modelThinkingLevels: { "xai/grok-4.6": "off" } }),
      "utf8",
    );
    writeLegacy({ "xai/grok-4.6": "xhigh", "openai/gpt-5": "low" });

    piRememberModel(makeFakePi());

    expect(readSettingsFile().modelThinkingLevels).toEqual({
      "xai/grok-4.6": "off",
      "openai/gpt-5": "low",
    });
    expect(existsSync(legacyPath())).toBe(false);
  });

  test("drops values pi does not know and still deletes the file", () => {
    useTempAgentDir();
    writeLegacy({ "xai/grok-4.6": "turbo" });

    piRememberModel(makeFakePi());

    // nothing worth keeping, so settings.json is not even created
    expect(existsSync(settingsPath())).toBe(false);
    expect(existsSync(legacyPath())).toBe(false);
  });

  test("deletes an unparseable file instead of retrying forever", () => {
    useTempAgentDir();
    writeLegacy("{ not json");

    piRememberModel(makeFakePi());

    expect(existsSync(legacyPath())).toBe(false);
  });

  test("is a no-op when the file is already gone", () => {
    useTempAgentDir();

    piRememberModel(makeFakePi());

    expect(existsSync(settingsPath())).toBe(false);
  });
});

describe("hasCliModelSelection", () => {
  test("sees --model and --models only when a value follows", () => {
    expect(hasCliModelSelection(["--model", "anthropic/haiku"])).toBe(true);
    expect(hasCliModelSelection(["--models", "anthropic/*"])).toBe(true);
    expect(hasCliModelSelection(["--model"])).toBe(false);
    expect(hasCliModelSelection(["-p", "hello --model world"])).toBe(false);
  });
});

describe("per-directory model memory", () => {
  test("remembers one model per directory without touching the others", () => {
    useTempAgentDir();

    rememberModel("/repo/a", "openai", "gpt-5");
    rememberModel("/repo/b", "xai", "grok-4.6");

    expect(rememberedModel("/repo/a")).toEqual({ provider: "openai", id: "gpt-5" });
    expect(rememberedModel("/repo/b")).toEqual({ provider: "xai", id: "grok-4.6" });
    expect(rememberedModel("/repo/c")).toBeUndefined();
  });

  test("starts fresh on invalid JSON or a malformed entry", () => {
    useTempAgentDir();
    mkdirSync(path.dirname(modelsPath()), { recursive: true });
    writeFileSync(modelsPath(), "{ not json", "utf8");

    expect(() => rememberModel("/repo/a", "openai", "gpt-5")).not.toThrow();
    expect(rememberedModel("/repo/a")).toEqual({ provider: "openai", id: "gpt-5" });

    writeFileSync(modelsPath(), JSON.stringify({ "/repo/a": "gpt-5" }), "utf8");
    expect(rememberedModel("/repo/a")).toBeUndefined();
  });
});

describe("extension wiring", () => {
  function makeFakePi() {
    const handlers = {};
    const appliedLevels = [];
    const appliedModels = [];
    return {
      handlers,
      appliedLevels,
      appliedModels,
      on(event, handler) {
        handlers[event] = handler;
      },
      setThinkingLevel(level) {
        appliedLevels.push(level);
      },
      async setModel(model) {
        appliedModels.push(`${model.provider}/${model.id}`);
        return true;
      },
    };
  }

  /** Minimal ExtensionContext: only `cwd`, `model`, and `modelRegistry.find` are read. */
  function makeCtx(cwd, model) {
    return {
      cwd,
      model,
      modelRegistry: {
        find: (provider, id) => ({ provider, id }),
      },
    };
  }

  test("model_select writes provider and id", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.model_select(
      { source: "set", model: { provider: "openai", id: "gpt-5" } },
      makeCtx("/repo/a", { provider: "openai", id: "gpt-5" }),
    );

    const written = readSettingsFile();
    expect(written.defaultProvider).toBe("openai");
    expect(written.defaultModel).toBe("gpt-5");
    expect(rememberedModel("/repo/a")).toEqual({ provider: "openai", id: "gpt-5" });
  });

  test("switching in one directory leaves another directory's model alone", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/b", "xai", "grok-4.6");

    await pi.handlers.model_select(
      { source: "set", model: { provider: "openai", id: "gpt-5" } },
      makeCtx("/repo/a", { provider: "openai", id: "gpt-5" }),
    );

    expect(rememberedModel("/repo/a")).toEqual({ provider: "openai", id: "gpt-5" });
    expect(rememberedModel("/repo/b")).toEqual({ provider: "xai", id: "grok-4.6" });
  });

  test("session_start restores the model remembered for that directory", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/a", "openai", "gpt-5");
    // pi starts every session on the global default, so that is what ctx.model holds here
    patchSettings({ defaultProvider: "anthropic", defaultModel: "haiku" });

    await pi.handlers.session_start(
      { reason: "new" },
      makeCtx("/repo/a", { provider: "anthropic", id: "haiku" }),
    );

    expect(pi.appliedModels).toEqual(["openai/gpt-5"]);
  });

  test("session_start leaves other directories on the global default", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/a", "openai", "gpt-5");
    patchSettings({ defaultProvider: "anthropic", defaultModel: "haiku" });

    await pi.handlers.session_start(
      { reason: "new" },
      makeCtx("/repo/b", { provider: "anthropic", id: "haiku" }),
    );

    expect(pi.appliedModels).toEqual([]);
  });

  test("session_start does not override a --model flag or a resumed session", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/a", "openai", "gpt-5");
    patchSettings({ defaultProvider: "anthropic", defaultModel: "haiku" });

    // the session already carries another model, so it claimed the slot before this extension
    await pi.handlers.session_start(
      { reason: "resume" },
      makeCtx("/repo/a", { provider: "xai", id: "grok-4.6" }),
    );

    expect(pi.appliedModels).toEqual([]);
  });

  test("session_start ignores a recorded model pi no longer knows", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/a", "gone", "removed-model");
    patchSettings({ defaultProvider: "anthropic", defaultModel: "haiku" });

    const ctx = makeCtx("/repo/a", { provider: "anthropic", id: "haiku" });
    ctx.modelRegistry.find = () => undefined;
    await pi.handlers.session_start({ reason: "new" }, ctx);

    expect(pi.appliedModels).toEqual([]);
  });

  test("the restore's own model_select never writes the global default or the directory", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    rememberModel("/repo/a", "openai", "gpt-5");
    patchSettings({ defaultProvider: "anthropic", defaultModel: "haiku" });
    const ctx = makeCtx("/repo/a", { provider: "anthropic", id: "haiku" });

    // pi.setModel emits model_select with source "set" from inside session_start
    pi.setModel = async (model) => {
      pi.appliedModels.push(`${model.provider}/${model.id}`);
      await pi.handlers.model_select({ source: "set", model }, ctx);
      return true;
    };

    await pi.handlers.session_start({ reason: "new" }, ctx);

    expect(readSettingsFile()).toEqual({
      defaultProvider: "anthropic",
      defaultModel: "haiku",
    });
    expect(rememberedModel("/repo/a")).toEqual({ provider: "openai", id: "gpt-5" });
  });

  test("model_select re-applies the level remembered for that model", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    const ctx = makeCtx("/repo/a", { provider: "xai", id: "grok-4.6" });

    // user turns thinking off on grok, then switches away and back
    await pi.handlers.thinking_level_select({ level: "off" }, ctx);
    await pi.handlers.model_select(
      { source: "set", model: { provider: "openai", id: "gpt-5" } },
      ctx,
    );
    await pi.handlers.model_select(
      { source: "set", model: { provider: "xai", id: "grok-4.6" } },
      ctx,
    );

    // gpt-5 has no remembered level, so only grok's is applied
    expect(pi.appliedLevels).toEqual(["off"]);
    expect(readSettingsFile().modelThinkingLevels).toEqual({ "xai/grok-4.6": "off" });
  });

  test("model_select ignores a stored level pi does not know", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);
    writeFileSync(
      settingsPath(),
      JSON.stringify({ modelThinkingLevels: { "xai/grok-4.6": "turbo" } }),
      "utf8",
    );

    await pi.handlers.model_select(
      { source: "set", model: { provider: "xai", id: "grok-4.6" } },
      makeCtx("/repo/a", { provider: "xai", id: "grok-4.6" }),
    );

    expect(pi.appliedLevels).toEqual([]);
  });

  test("model_select skips session restore", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.model_select(
      { source: "restore", model: { provider: "openai", id: "gpt-5" } },
      makeCtx("/repo/a", { provider: "openai", id: "gpt-5" }),
    );

    expect(existsSync(settingsPath())).toBe(false);
    expect(existsSync(modelsPath())).toBe(false);
    expect(pi.appliedLevels).toEqual([]);
  });

  test("thinking_level_select writes the level of the current model only", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.thinking_level_select(
      { level: "high" },
      { model: { provider: "openai", id: "gpt-5" } },
    );
    // a second model that cannot support "high" must not clobber the first model's level
    await pi.handlers.thinking_level_select(
      { level: "low" },
      { model: { provider: "anthropic", id: "haiku" } },
    );

    expect(readSettingsFile()).toEqual({
      modelThinkingLevels: {
        "openai/gpt-5": "high",
        "anthropic/haiku": "low",
      },
    });
  });

  test("thinking_level_select never writes the global default", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.thinking_level_select(
      { level: "low" },
      { model: { provider: "anthropic", id: "haiku" } },
    );

    expect(readSettingsFile().defaultThinkingLevel).toBeUndefined();
  });

  test("thinking_level_select without a current model writes nothing", async () => {
    useTempAgentDir();
    const pi = makeFakePi();
    piRememberModel(pi);

    await pi.handlers.thinking_level_select({ level: "high" }, {});

    expect(existsSync(settingsPath())).toBe(false);
  });
});
