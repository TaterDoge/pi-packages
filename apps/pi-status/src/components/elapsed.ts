import type { ComponentRenderInput } from "./type.ts";

const MINUTE_MS = 60_000;

/**
 * Wall clock since session start, floored to a display unit. Seconds are deliberately not shown:
 * the module is only redrawn with the rest of the border (the git poll gives a fresh frame every
 * 30s), so a second-level counter would stutter.
 */
export function formatSessionElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE_MS);
  if (minutes < 1) return "<1m";
  const hours = Math.floor(minutes / 60);
  return hours < 1 ? `${minutes}m` : `${hours}h${minutes % 60}m`;
}

export function renderElapsedComponent({ state }: ComponentRenderInput): string {
  if (state.sessionStartedAt === undefined) return "";
  return `⏱ ${formatSessionElapsed(Date.now() - state.sessionStartedAt)}`;
}
