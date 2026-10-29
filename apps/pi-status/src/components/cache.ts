import type { SessionTotals } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

/**
 * Share of prompt tokens that were served from the provider cache, or undefined when the provider
 * reported no prompt tokens at all (no caching support). Cache writes count as misses: they are
 * prompt tokens that had to be processed, just at a different price.
 *
 * Undefined renders as 0%: the module is on by default, so it shows its icon before any cache hit.
 */
export function cacheHitPercent(totals: SessionTotals): number | undefined {
  // Older totals objects may omit the cache fields; count them as zero instead of NaN.
  const cacheRead = totals.cacheRead ?? 0;
  const promptTokens = (totals.input ?? 0) + cacheRead + (totals.cacheWrite ?? 0);
  if (promptTokens <= 0) return undefined;
  return Math.round((cacheRead / promptTokens) * 100);
}

export function renderCacheComponent({ state }: ComponentRenderInput): string {
  return `⛁ ${cacheHitPercent(state.totals) ?? 0}%`;
}
