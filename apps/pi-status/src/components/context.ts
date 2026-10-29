import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import { CONTEXT_BAR_STYLES } from "../constants.ts";
import { formatUsageCount } from "../session-totals.ts";
import type { ContextBarStyleId } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

const BAR_WIDTH = 10;

function progressThemeColor(percent: number | undefined): ThemeColor {
  if (percent === undefined) return "success";
  if (percent >= 90) return "error";
  if (percent >= 60) return "warning";
  return "success";
}

function renderProgressBar(
  percent: number | undefined,
  styleId: ContextBarStyleId,
  theme: Pick<import("@earendil-works/pi-coding-agent").Theme, "fg" | "bold">,
): string {
  const clamped = percent === undefined ? 0 : Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const color = progressThemeColor(percent);
  const tokens = CONTEXT_BAR_STYLES[styleId];
  const filledText = theme.fg(color, tokens.filled.repeat(filled));
  const trackText = theme.fg("muted", tokens.track.repeat(BAR_WIDTH - filled));
  return `${filledText}${trackText}`;
}

export function renderContextComponent({ state, theme, config }: ComponentRenderInput): string {
  if (!state.contextWindow || state.contextWindow <= 0) return "--";

  const percent = state.contextPercent;
  // One decimal at most, so float noise stays out of the bar label.
  const percentLabel =
    percent === undefined ? "?%" : `${Math.round(Math.max(0, Math.min(999, percent)) * 10) / 10}%`;
  return `ctx ${renderProgressBar(percent, config.contextBarStyle, theme)} ${percentLabel}/${formatUsageCount(state.contextWindow)}`;
}
