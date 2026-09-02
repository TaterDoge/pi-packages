import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Pi global settings.json — same resolution as pi's own SettingsManager. */
export function settingsPath(): string {
  const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(dir, "settings.json");
}

/** Read-merge-write a patch into settings.json, preserving all other keys. Never throws. */
export function patchSettings(patch: Record<string, string>): void {
  try {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(readFileSync(settingsPath(), "utf8")) as Record<string, unknown>;
    } catch {
      // no file yet or invalid JSON — start fresh
    }
    writeFileSync(settingsPath(), `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, "utf8");
  } catch (error) {
    // never let this break pi
    console.error("[pi-remember-model] settings write failed:", error);
  }
}

export default function piRememberModel(pi: ExtensionAPI) {
  pi.on("model_select", async (event) => {
    // "restore" replays a model loaded from a session file, not a user choice —
    // persisting it would let any opened session silently rewrite the default.
    if (event.source === "restore") return;
    patchSettings({
      defaultProvider: event.model.provider,
      defaultModel: event.model.id,
    });
  });

  pi.on("thinking_level_select", async (event) => {
    patchSettings({ defaultThinkingLevel: event.level });
  });
}
