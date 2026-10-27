import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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

/**
 * Per-directory model memory, kept beside the extension's own data. A sidecar file, not
 * settings.json: every pi instance writes its own cwd's entry, so a read-merge-write of the whole
 * map races far less than patching settings.json.
 */
export function modelsPath(): string {
  return join(agentDir(), "extensions", "pi-remember-model", "models.json");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(file: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Current settings.json contents; `{}` when the file is missing or invalid. Never throws. */
export function readSettings(): Record<string, unknown> {
  return readJson(settingsPath());
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

/** The model last selected in `cwd`, or undefined when that directory has no record. */
export function rememberedModel(cwd: string): { provider: string; id: string } | undefined {
  const entry = readJson(modelsPath())[cwd];
  if (!isPlainObject(entry)) return undefined;
  const { provider, id } = entry;
  return typeof provider === "string" && typeof id === "string" ? { provider, id } : undefined;
}

/** Remember a model for one directory. Never throws. */
export function rememberModel(cwd: string, provider: string, id: string): void {
  try {
    const file = modelsPath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({ ...readJson(file), [cwd]: { provider, id } }, null, 2)}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("[pi-remember-model] model write failed:", error);
  }
}

/**
 * Level stored for a model in Pi's own `modelThinkingLevels` map, or undefined when none was
 * chosen (or the value is unknown).
 */ export function storedThinkingLevel(
  provider: string,
  modelId: string,
): ThinkingLevel | undefined {
  const levels = readSettings().modelThinkingLevels;
  const level = isPlainObject(levels) ? levels[`${provider}/${modelId}`] : undefined;
  return typeof level === "string" ? THINKING_LEVELS.find((known) => known === level) : undefined;
}

/**
 * True when the session is about to start on Pi's global default, meaning nothing (a `--model`
 * flag, a resumed session's own `model_change`) has claimed the slot yet and this directory's
 * memory may. A session resuming its own model arrives here with a different model, so it wins.
 */
function onGlobalDefault(ctx: ExtensionContext): boolean {
  const settings = readSettings();
  return (
    settings.defaultProvider === ctx.model?.provider && settings.defaultModel === ctx.model?.id
  );
}

/** 0.1.2 kept levels here; every later release uses pi's own `modelThinkingLevels`. */
function legacyThinkingLevelsPath(): string {
  return join(agentDir(), "extensions", "pi-remember-model", "thinking-levels.json");
}

/**
 * Fold the 0.1.2 level cache into `modelThinkingLevels`, then delete it. Pi never read that file,
 * so an upgraded install would silently drop the levels the user picked before upgrading — and one
 * still left on disk after this release would never be cleaned up.
 */
function migrateLegacyThinkingLevels(): void {
  const file = legacyThinkingLevelsPath();
  // Runs on every extension load, including /reload, so the common path must stay a stat call.
  if (!existsSync(file)) return;
  try {
    const legacy = JSON.parse(readFileSync(file, "utf8"));
    if (isPlainObject(legacy)) {
      const current = readSettings().modelThinkingLevels;
      const known = isPlainObject(current) ? current : {};
      const missing = Object.fromEntries(
        Object.entries(legacy).filter(
          ([key, level]) =>
            typeof level === "string" &&
            THINKING_LEVELS.some((knownLevel) => knownLevel === level) &&
            // A level re-picked since the upgrade already lives in settings and wins.
            !(key in known),
        ),
      );
      if (Object.keys(missing).length > 0) patchSettings({ modelThinkingLevels: missing });
    }
  } catch (error) {
    // Unreadable or malformed: still delete it, it can never be read again.
    console.error("[pi-remember-model] could not migrate thinking-levels.json:", error);
  }
  try {
    unlinkSync(file);
  } catch (error) {
    console.error("[pi-remember-model] could not remove thinking-levels.json:", error);
  }
}

export default function piRememberModel(pi: ExtensionAPI) {
  migrateLegacyThinkingLevels();

  // Set while this extension applies a remembered model. `pi.setModel` emits `model_select` with
  // source "set" — indistinguishable from a user pick — so without this the restore would write
  // itself back out, and the global default would flip on every session start.
  let restoring = false;

  // model_select never fires for a session that starts with no model change, so the directory's
  // record is applied here. Runs for "new" and "fork" (they rebuild the runtime) but also
  // "startup" and "resume", hence the global-default guard.
  pi.on("session_start", async (_event, ctx) => {
    const remembered = rememberedModel(ctx.cwd);
    if (!remembered || !onGlobalDefault(ctx)) return;
    const model = ctx.modelRegistry.find(remembered.provider, remembered.id);
    // A model that was removed or lost its credentials leaves the session on the global default.
    if (!model) return;
    restoring = true;
    try {
      await pi.setModel(model);
    } finally {
      restoring = false;
    }
  });

  pi.on("model_select", async (event, ctx) => {
    // "restore" replays a model loaded from a session file, not a user choice —
    // persisting it would let any opened session silently rewrite the default.
    if (event.source === "restore" || restoring) return;
    const { provider, id } = event.model;
    // Global default stays the fallback for directories without a record.
    patchSettings({ defaultProvider: provider, defaultModel: id });
    rememberModel(ctx.cwd, provider, id);
    // Pi reads `modelThinkingLevels` from disk only while booting and keeps its own in-memory
    // copy, which never sees a level this extension writes: re-apply it here so switching back
    // to a model lands on its level. The `thinking_level_select` handler covers the next start.
    const level = storedThinkingLevel(provider, id);
    // Cast: the oldest supported peer (pi 0.76) knows fewer levels than newer pis emit
    // (e.g. "max"); the value is already validated against THINKING_LEVELS in
    // storedThinkingLevel, so adapt it to whichever union this build typechecks against.
    if (level) pi.setThinkingLevel(level as Parameters<typeof pi.setThinkingLevel>[0]);
  });

  pi.on("thinking_level_select", async (event, ctx) => {
    // Per-model key in Pi's own `modelThinkingLevels`, the map its startup resolver reads.
    // A level one model cannot support never leaks into another. Deliberately no
    // `defaultThinkingLevel` write: pi emits this event for clamped levels too (e.g. mid model
    // switch), and a global write would let that clamped value degrade every model falling
    // back to the default.
    // Known ceiling: the level stored is the clamped one pi settled on, so a model that cannot
    // honour a level is remembered at the level it actually ran.
    const model = ctx.model;
    if (!model) return;
    patchSettings({ modelThinkingLevels: { [`${model.provider}/${model.id}`]: event.level } });
  });
}
