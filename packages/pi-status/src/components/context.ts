import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import { CONTEXT_BAR_STYLES } from "../constants.ts";
import type { ContextBarStyleId } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

const BAR_WIDTH = 10;

function progressThemeColor(percent: number | undefined): ThemeColor {
  if (percent === undefined) return "success";
  if (percent >= 90) return "error";
  if (percent >= 60) return "warning";
  return "success";
}

function parseContextLabel(label: string): { percent?: number; window: string } | undefined {
  const match = /^(\?|\d+)%\/(.+)$/.exec(label);
  if (!match) return undefined;
  return {
    percent: match[1] === "?" ? undefined : Number(match[1]),
    window: match[2],
  };
}

function getBarTokens(styleId: ContextBarStyleId): { filled: string; track: string } {
  return CONTEXT_BAR_STYLES[styleId];
}

function renderProgressBar(
  percent: number | undefined,
  styleId: ContextBarStyleId,
  theme: Pick<import("@earendil-works/pi-coding-agent").Theme, "fg" | "bold">,
): string {
  const clamped = percent === undefined ? 0 : Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const color = progressThemeColor(percent);
  const tokens = getBarTokens(styleId);
  const filledText = theme.fg(color, tokens.filled.repeat(filled));
  const trackText = theme.fg("muted", tokens.track.repeat(BAR_WIDTH - filled));
  return `${filledText}${trackText}`;
}

export function renderContextComponent({ state, theme, config }: ComponentRenderInput): string {
  const context = parseContextLabel(state.contextLabel);
  if (!context) return state.contextLabel;

  const percentLabel = context.percent === undefined ? "?%" : `${context.percent}%`;
  return `ctx ${renderProgressBar(context.percent, config.contextBarStyle, theme)} ${percentLabel}/${context.window}`;
}
