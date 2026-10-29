// fallow-ignore-file unused-file
import { describe, expect, test } from "bun:test";
import { formatUsageCount, formatUsd, readSessionTotals } from "../src/session-totals.ts";

function ctxWith(entries) {
  return { sessionManager: { getEntries: () => entries } };
}

const assistant = (usage) => ({ type: "message", message: { role: "assistant", usage } });

describe("readSessionTotals", () => {
  test("sums input, output and cost over every assistant entry", () => {
    const totals = readSessionTotals(
      ctxWith([
        assistant({ input: 100, output: 40, cost: { total: 0.01 } }),
        assistant({ input: 50, output: 10, cost: { total: 0.002 } }),
      ]),
    );
    expect(totals).toEqual({ input: 150, output: 50, cost: 0.012 });
  });

  test("ignores non-assistant and usage-less entries", () => {
    const totals = readSessionTotals(
      ctxWith([
        { type: "message", message: { role: "user" } },
        { type: "session_info", name: "x" },
        assistant(undefined),
        assistant({ input: 7 }),
      ]),
    );
    expect(totals).toEqual({ input: 7, output: 0, cost: 0 });
  });

  test("returns zeros when the session has no assistant entries", () => {
    expect(readSessionTotals(ctxWith([]))).toEqual({ input: 0, output: 0, cost: 0 });
  });

  test("scans the session once per call", () => {
    let scans = 0;
    const getEntries = () => {
      scans += 1;
      return [assistant({ input: 1 })];
    };
    readSessionTotals({ sessionManager: { getEntries } });
    expect(scans).toBe(1);
  });
});

describe("formatters", () => {
  test("formatUsageCount switches units at 1k and 10k", () => {
    expect(formatUsageCount(999)).toBe("999");
    expect(formatUsageCount(1234)).toBe("1.2k");
    expect(formatUsageCount(12_345)).toBe("12k");
  });

  test("formatUsd keeps small amounts readable", () => {
    expect(formatUsd(0)).toBe("$0.000");
    expect(formatUsd(0.0012)).toBe("$0.0012");
    expect(formatUsd(0.42)).toBe("$0.420");
    expect(formatUsd(12.4)).toBe("$12");
  });
});
