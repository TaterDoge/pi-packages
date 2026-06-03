import type { ComponentRenderInput } from "./type.ts";

const BAR_WIDTH = 10;
const FILLED = "◼";
const TRACK = "◻";

function parseContextLabel(label: string): { percent?: number; window: string } | undefined {
  const match = /^(\?|\d+)%\/(.+)$/.exec(label);
  if (!match) return undefined;
  return {
    percent: match[1] === "?" ? undefined : Number(match[1]),
    window: match[2],
  };
}

function renderProgressBar(percent: number | undefined): string {
  const clamped = percent === undefined ? 0 : Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);

  // These square glyphs keep the original block feel while rendering with a bit more breathing room.
  return Array.from({ length: BAR_WIDTH }, (_, index) => (index < filled ? FILLED : TRACK)).join(
    "",
  );
}

export function renderContextComponent({ state }: ComponentRenderInput): string {
  const context = parseContextLabel(state.contextLabel);
  if (!context) return state.contextLabel;

  const percentLabel = context.percent === undefined ? "?%" : `${context.percent}%`;
  return `ctx ${renderProgressBar(context.percent)} ${percentLabel}/${context.window}`;
}
