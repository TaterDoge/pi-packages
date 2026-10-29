import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { COMPONENT_RENDERERS } from "./components/index.ts";
import { STATUS_STYLES } from "./constants.ts";
import type { PiStatusConfig, RuntimeState, Zone } from "./types.ts";

// ── ANSI helpers ──────────────────────────────────────────────

const ANSI_COLORS = new Map<string, number>([
  ["black", 30],
  ["red", 31],
  ["green", 32],
  ["yellow", 33],
  ["blue", 34],
  ["magenta", 35],
  ["purple", 35],
  ["cyan", 36],
  ["white", 37],
  ["bright-black", 90],
  ["bright-red", 91],
  ["bright-green", 92],
  ["bright-yellow", 93],
  ["bright-blue", 94],
  ["bright-magenta", 95],
  ["bright-purple", 95],
  ["bright-cyan", 96],
  ["bright-white", 97],
]);

/**
 * Apply a style string: terminal colour names become raw SGR codes, anything else is treated as a
 * theme colour. Both can be combined ("bold accent"), and an unknown token leaves the text plain.
 */
function renderStyle(theme: Pick<Theme, "fg" | "bold">, style: string, text: string): string {
  const codes: string[] = [];
  let themeColor: string | undefined;

  for (const token of style.trim().split(/\s+/)) {
    if (!token) continue;
    if (token === "bold") {
      codes.push("1");
      continue;
    }
    if (token === "dim" || token === "dimmed") {
      codes.push("2");
      continue;
    }
    const code = ANSI_COLORS.get(token.toLowerCase());
    if (code !== undefined) {
      codes.push(`${code}`);
      continue;
    }
    themeColor = token;
  }

  let styled = text;
  if (themeColor) {
    try {
      styled = theme.fg(themeColor as ThemeColor, styled);
    } catch {
      // Unknown colour name: keep the text uncoloured rather than throwing inside render.
    }
  }
  return codes.length > 0 ? `\x1b[${codes.join(";")}m${styled}\x1b[0m` : styled;
}

// ── Zone content collection ───────────────────────────────────

/** Collect styled segments for a specific zone. */
export function collectZoneSegments(
  config: PiStatusConfig,
  state: RuntimeState,
  ctx: ExtensionContext,
  theme: Pick<Theme, "fg" | "bold">,
  zone: Zone,
): string[] {
  const segments: string[] = [];
  for (const component of config.components) {
    if (!component.enabled) continue;
    if (component.zone !== zone) continue;
    const value = COMPONENT_RENDERERS[component.id]({ state, ctx, theme, config });
    if (!value) continue;
    const style =
      component.id === "runtime" && state.runtime
        ? state.runtime.style
        : STATUS_STYLES[component.id];
    segments.push(renderStyle(theme, style, value));
  }
  return segments;
}

/** Join segments for a zone with the styled separator. */
export function joinZoneSegments(
  config: PiStatusConfig,
  theme: Pick<Theme, "fg" | "bold">,
  segments: string[],
): string {
  if (segments.length === 0) return "";
  const sep = renderStyle(theme, STATUS_STYLES.separator, config.separator);
  return segments.join(sep);
}

/** Collect and join segments for a specific zone. */
export function renderZoneContent(
  config: PiStatusConfig,
  state: RuntimeState,
  ctx: ExtensionContext,
  theme: Pick<Theme, "fg" | "bold">,
  zone: Zone,
): string {
  const segments = collectZoneSegments(config, state, ctx, theme, zone);
  return joinZoneSegments(config, theme, segments);
}
