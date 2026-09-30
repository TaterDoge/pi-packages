import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Pi's thinking levels. The union is not re-exported by the package, so it is mirrored here. */
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function agentDir(): string {
  return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

/** Pi global settings.json — same resolution as pi's own SettingsManager. */
export function settingsPath(): string {
  return join(agentDir(), "settings.json");
}

/** Per-model thinking levels, kept out of Pi's settings.json. */
export function thinkingLevelsPath(): string {
  return join(agentDir(), "extensions", "pi-remember-model", "thinking-levels.json");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Current settings.json contents; `{}` when the file is missing or invalid. Never throws. */
export function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(settingsPath(), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Read-merge-write a patch into settings.json, preserving all other keys. Object values
 * merge one level deep. Never throws.
 */
export function patchSettings(patch: Record<string, unknown>): void {
  try {
    const merged = { ...readSettings() };
    for (const [key, value] of Object.entries(patch)) {
      const previous = merged[key];
      merged[key] =
        isPlainObject(value) && isPlainObject(previous) ? { ...previous, ...value } : value;
    }
    writeFileSync(settingsPath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  } catch (error) {
    // never let this break pi
    console.error("[pi-remember-model] settings write failed:", error);
  }
}

/** Current thinking-level cache; `{}` when the file is missing or invalid. Never throws. */
export function readThinkingLevels(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(thinkingLevelsPath(), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Merge one model entry into the plugin cache. Never throws. */
export function patchThinkingLevel(provider: string, modelId: string, level: string): void {
  try {
    const file = thinkingLevelsPath();
    mkdirSync(dirname(file), { recursive: true });
    const merged = { ...readThinkingLevels(), [`${provider}/${modelId}`]: level };
    writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("[pi-remember-model] thinking level write failed:", error);
  }
}

/** Level stored for a model, or undefined when none was chosen (or the value is unknown). */
export function storedThinkingLevel(provider: string, modelId: string): ThinkingLevel | undefined {
  const level = readThinkingLevels()[`${provider}/${modelId}`];
  return typeof level === "string" ? THINKING_LEVELS.find((known) => known === level) : undefined;
}

export default function piRememberModel(pi: ExtensionAPI) {
  pi.on("model_select", async (event) => {
    // "restore" replays a model loaded from a session file, not a user choice —
    // persisting it would let any opened session silently rewrite the default.
    if (event.source === "restore") return;
    const { provider, id } = event.model;
    patchSettings({ defaultProvider: provider, defaultModel: id });
    // Pi reads `modelThinkingLevels` while booting only, so it never notices a level written
    // mid-session: re-apply the remembered level here. The write above covers the next start.
    const level = storedThinkingLevel(provider, id);
    // Cast: the oldest supported peer (pi 0.76) knows fewer levels than newer pis emit
    // (e.g. "max"); the value is already validated against THINKING_LEVELS in
    // storedThinkingLevel, so adapt it to whichever union this build typechecks against.
    if (level) pi.setThinkingLevel(level as Parameters<typeof pi.setThinkingLevel>[0]);
  });

  pi.on("thinking_level_select", async (event, ctx) => {
    // Per-model cache in the plugin directory, not Pi's settings.json. A level one model
    // cannot support never leaks into another. Deliberately no `defaultThinkingLevel` write:
    // pi emits this event for clamped levels too (e.g. mid model switch), and a global write
    // would let that clamped value degrade every model falling back to the default.
    // Known ceiling: a clamped level seen while passing through a model is stored as that
    // model's entry, pinning it until the entry is deleted from thinking-levels.json.
    const model = ctx.model;
    if (!model) return;
    patchThinkingLevel(model.provider, model.id, event.level);
  });
}
