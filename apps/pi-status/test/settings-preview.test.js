// fallow-ignore-file unused-file
import { describe, expect, test } from "bun:test";

import { visibleWidth } from "@earendil-works/pi-tui";
import { ALL_COMPONENT_IDS, CONTEXT_BAR_STYLES, DEFAULT_CONFIG } from "../src/constants.ts";
import { buildConfigPayload, plainText, renderPreview } from "../src/settings/preview.ts";

// Only `fg` and `bold` are exercised by the renderers; a stub keeps the test offline.
const theme = {
  fg: (_color, text) => text,
  bold: (text) => text,
};

function makeInput(config, width) {
  return {
    config,
    width,
    state: {
      activity: "idle",
      running: false,
      destroyed: false,
      turnIndex: 0,
      modelLabel: "claude",
      providerLabel: "anthropic",
      contextPercent: 42,
      contextWindow: 200000,
      totals: { input: 1000, output: 500, cost: 0.4 },
      thinkingLevel: "off",
      currentTool: "",
      toolStartedAt: undefined,
      tpsLabel: "0 tok/s",
      runtime: undefined,
      spinnerIndex: 0,
      branch: "main",
      ahead: 0,
      behind: 0,
      conflicted: 0,
      untracked: 0,
      stashed: false,
      modified: 0,
      staged: 0,
      renamed: 0,
      deleted: 0,
      typechanged: 0,
    },
    ctx: {
      cwd: "/tmp/demo",
      sessionManager: { getEntries: () => [] },
      getContextUsage: () => ({ percent: 42, contextWindow: 200000 }),
    },
    theme,
  };
}

describe("renderPreview", () => {
  test("fills the full requested width", () => {
    const preview = renderPreview(makeInput(DEFAULT_CONFIG, 100));
    expect(visibleWidth(preview.top)).toBe(100);
    expect(visibleWidth(preview.bottom)).toBe(100);
    expect(preview.width).toBe(100);
  });

  test("keeps both zones on their own side of the row", () => {
    const preview = renderPreview(makeInput(DEFAULT_CONFIG, 120));
    // top-left segments come first, top-right last, so the cost segment must sit rightmost.
    expect(preview.top.indexOf("main")).toBeLessThan(preview.top.lastIndexOf("$"));
    expect(plainText(preview.top)).toContain("main");
  });

  test("drops the right zone before the left one when the row is too narrow", () => {
    const narrow = renderPreview(makeInput(DEFAULT_CONFIG, 24));
    expect(visibleWidth(narrow.top)).toBe(24);
    // The left zone still shows something; the right zone is gone.
    expect(plainText(narrow.top)).toContain("idle");
    expect(plainText(narrow.top)).not.toContain("$");
  });

  test("never exceeds the width even at the minimum", () => {
    for (const width of [2, 3, 10, 40, 200]) {
      const preview = renderPreview(makeInput(DEFAULT_CONFIG, width));
      expect(visibleWidth(preview.top)).toBe(width);
      expect(visibleWidth(preview.bottom)).toBe(width);
    }
  });

  test("renders empty rows when every component is disabled", () => {
    const config = {
      ...DEFAULT_CONFIG,
      components: DEFAULT_CONFIG.components.map((component) => ({ ...component, enabled: false })),
    };
    const preview = renderPreview(makeInput(config, 40));
    expect(plainText(preview.top).trim()).toBe(`${"╭"}${"─".repeat(38)}${"╮"}`.trim());
  });

  test("keeps ANSI styling in the output", () => {
    // Real Theme.fg emits truecolor SGR; the page parses exactly this shape.
    const ansiTheme = {
      fg: (_color, text) => `\x1b[38;2;0;215;255m${text}\x1b[39m`,
      bold: (text) => `\x1b[1m${text}\x1b[22m`,
    };
    const preview = renderPreview({ ...makeInput(DEFAULT_CONFIG, 80), theme: ansiTheme });
    expect(preview.top).toContain("\x1b[38;2;0;215;255m");
    expect(preview.top).toContain("\x1b[39m");
  });
});

describe("plainText", () => {
  test("strips SGR escapes", () => {
    expect(plainText("\x1b[1;36mhello\x1b[0m world")).toBe("hello world");
  });

  test("leaves plain text untouched", () => {
    expect(plainText("idle")).toBe("idle");
  });
});

describe("buildConfigPayload", () => {
  test("ships the live samples, defaults and target path", () => {
    const input = makeInput(DEFAULT_CONFIG, 100);
    const payload = buildConfigPayload({
      config: DEFAULT_CONFIG,
      defaults: DEFAULT_CONFIG,
      state: input.state,
      ctx: input.ctx,
      theme: input.theme,
      targetPath: "/tmp/config.json",
      maxSeparatorWidth: 8,
      contextBarStyles: Object.entries(CONTEXT_BAR_STYLES).map(([id, style]) => ({
        id,
        label: style.label,
      })),
    });

    // Every component id must have a sample, or the tray shows blank rows.
    expect(Object.keys(payload.samples).sort()).toEqual([...ALL_COMPONENT_IDS].sort());
    expect(payload.samples.cwd).toBe("󰝰 demo");
    // Totals come from the live state, so the tray can show real token/cost values.
    expect(payload.samples.tokens).toBe("↑1.0k ↓500");
    expect(payload.samples.cost).toBe("$0.400");
    expect(payload.meta.targetPath).toBe("/tmp/config.json");
    expect(payload.meta.maxSeparatorWidth).toBe(8);
  });
});
