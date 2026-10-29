// fallow-ignore-file unused-file
import { describe, expect, test } from "bun:test";
import { cacheHitPercent, renderCacheComponent } from "../src/components/cache.ts";
import { formatSessionElapsed, renderElapsedComponent } from "../src/components/elapsed.ts";

const totals = (input, cacheRead, cacheWrite) => ({
  input,
  output: 0,
  cacheRead,
  cacheWrite,
  cost: 0,
});

describe("cacheHitPercent", () => {
  test("is the cached share of every prompt token", () => {
    expect(cacheHitPercent(totals(100, 900, 0))).toBe(90);
    expect(cacheHitPercent(totals(0, 0, 0))).toBeUndefined();
  });

  test("counts cache writes as misses", () => {
    expect(cacheHitPercent(totals(0, 500, 500))).toBe(50);
  });
});

describe("renderCacheComponent", () => {
  const input = (usage) => ({ state: { totals: usage } });

  test("renders the hit rate", () => {
    expect(renderCacheComponent(input(totals(10, 90, 0)))).toBe("⛁ 90%");
  });

  test("renders 0% when the provider reported no prompt tokens", () => {
    expect(renderCacheComponent(input(totals(0, 0, 0)))).toBe("⛁ 0%");
  });
});

describe("formatSessionElapsed", () => {
  test("floors to minutes, then hours", () => {
    expect(formatSessionElapsed(0)).toBe("<1m");
    expect(formatSessionElapsed(59_000)).toBe("<1m");
    expect(formatSessionElapsed(90_000)).toBe("1m");
    expect(formatSessionElapsed(41 * 60_000)).toBe("41m");
    expect(formatSessionElapsed(3 * 3600_000 + 12 * 60_000)).toBe("3h12m");
  });
});

describe("renderElapsedComponent", () => {
  test("renders the wall clock since session start", () => {
    const state = { sessionStartedAt: Date.now() - 12 * 60_000 };
    expect(renderElapsedComponent({ state })).toBe("⏱ 12m");
  });

  test("stays empty before session_start set the timestamp", () => {
    expect(renderElapsedComponent({ state: { sessionStartedAt: undefined } })).toBe("");
  });
});
