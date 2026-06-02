import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { COMPONENT_RENDERERS } from "./components/index.ts";
import { STATUS_STYLES } from "./constants.ts";
import type { PiStatusConfig, RuntimeState, Zone } from "./types.ts";

// ── ANSI helpers ──────────────────────────────────────────────

function terminalColorToAnsi(color: string, isBackground = false): string | undefined {
  const codes = new Map([
    ["black", 30],
    ["red", 31],
    ["green", 32],
    ["yellow", 33],
    ["blue", 34],
    ["purple", 35],
    ["cyan", 36],
    ["white", 37],
    ["bright-black", 90],
    ["bright-red", 91],
    ["bright-green", 92],
    ["bright-yellow", 93],
    ["bright-blue", 94],
    ["bright-purple", 95],
    ["bright-cyan", 96],
    ["bright-white", 97],
  ]);
  const code = codes.get(color.toLowerCase());
  return code === undefined ? undefined : `${isBackground ? code + 10 : code}`;
}

function renderStyle(theme: Pick<Theme, "fg" | "bold">, style: string, text: string): string {
  const ansiCodes: string[] = [];
  let themeColor: string | undefined;
  let themedText = text;

  for (const token of style.trim().split(/\s+/)) {
    if (!token) continue;
    const normalized = token.toLowerCase();
    if (normalized === "bold") {
      themedText = theme.bold(themedText);
      ansiCodes.push("1");
      continue;
    }
    if (normalized === "dim" || normalized === "dimmed") {
      ansiCodes.push("2");
      themeColor ??= "muted";
      continue;
    }
    const isForeground = normalized.startsWith("fg:");
    const isBackground = normalized.startsWith("bg:");
    const color = terminalColorToAnsi(
      isForeground || isBackground ? normalized.slice(3) : normalized,
      isBackground,
    );
    if (color) {
      ansiCodes.push(color);
      continue;
    }
    themeColor = token;
  }

  if (ansiCodes.length > 0) return `\x1b[${ansiCodes.join(";")}m${text}\x1b[0m`;
  if (!themeColor) return themedText;
  try {
    return theme.fg(themeColor as ThemeColor, themedText);
  } catch {
    return themedText;
  }
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
    const value = COMPONENT_RENDERERS[component.id]({ state, ctx, theme });
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

// ── Flat fallback rendering ───────────────────────────────────

/**
 * Flat rendering: all enabled segments joined by separator, single line.
 * Used as fallback when CustomEditor is not available or width is too narrow.
 */
export function renderFlatLine(
  config: PiStatusConfig,
  state: RuntimeState,
  ctx: ExtensionContext,
  theme: Pick<Theme, "fg" | "bold">,
  width: number,
): string {
  const separator = renderStyle(theme, STATUS_STYLES.separator, config.separator);
  const segments: string[] = [];
  for (const component of config.components) {
    if (!component.enabled) continue;
    const value = COMPONENT_RENDERERS[component.id]({ state, ctx, theme });
    if (!value) continue;
    const style =
      component.id === "runtime" && state.runtime
        ? state.runtime.style
        : STATUS_STYLES[component.id];
    segments.push(renderStyle(theme, style, value));
  }
  return truncateToWidth(segments.join(separator), Math.max(0, width), "");
}
