// fallow-ignore-file unused-file
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { visibleWidth } from "@earendil-works/pi-tui";
import { fitBorder } from "../src/border.ts";
import { parseGitStatusPorcelain } from "../src/components/git.ts";
import { hasRootMarker } from "../src/components/runtime.ts";
import { validatePiStatusConfig } from "../src/config.ts";
import { DEFAULT_CONFIG, MAX_SEPARATOR_WIDTH } from "../src/constants.ts";
import piStatus from "../src/index.ts";
import { renderZoneContent } from "../src/render.ts";

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-status-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("DEFAULT_CONFIG", () => {
  test("matches the requested standalone defaults", () => {
    expect(DEFAULT_CONFIG).toEqual({
      separator: " · ",
      components: [
        { id: "status", enabled: true, zone: "top-left" },
        { id: "cwd", enabled: true, zone: "top-left" },
        { id: "turn", enabled: true, zone: "top-left" },
        { id: "current_tool", enabled: true, zone: "top-left" },
        { id: "git", enabled: true, zone: "top-left" },
        { id: "runtime", enabled: true, zone: "top-left" },
        { id: "cost", enabled: true, zone: "top-right" },
        { id: "model", enabled: true, zone: "bottom-left" },
        { id: "thinking", enabled: true, zone: "bottom-left" },
        { id: "tps", enabled: true, zone: "bottom-left" },
        { id: "tokens", enabled: true, zone: "bottom-right" },
        { id: "context", enabled: true, zone: "bottom-right" },
        { id: "cache", enabled: true, zone: "bottom-right" },
        { id: "elapsed", enabled: false, zone: "top-left" },
      ],
      contextBarStyle: "blocks",
    });
  });
});

describe("validatePiStatusConfig", () => {
  test("fills in missing defaults while preserving explicit values", () => {
    const config = validatePiStatusConfig({
      separator: " / ",
      components: [
        { id: "status", enabled: false, zone: "bottom-right" },
        { id: "tokens", enabled: true, zone: "bottom-left" },
      ],
    });

    expect(config?.separator).toBe(" / ");
    expect(config?.components[0]).toEqual({
      id: "status",
      enabled: false,
      zone: "bottom-right",
    });
    expect(config?.components.find((component) => component.id === "tokens")).toEqual({
      id: "tokens",
      enabled: true,
      zone: "bottom-left",
    });
    expect(config?.components).toHaveLength(DEFAULT_CONFIG.components.length);
  });

  test("rejects non-object config payloads", () => {
    expect(validatePiStatusConfig([])).toBeNull();
  });

  test("clamps a separator past the display-width ceiling", () => {
    const config = validatePiStatusConfig({ separator: "—".repeat(40) });
    expect(config).not.toBeNull();
    expect(visibleWidth(config.separator)).toBeLessThanOrEqual(MAX_SEPARATOR_WIDTH);
  });
});

describe("fitBorder", () => {
  test("keeps content within width by truncating the right side first", () => {
    const color = (text) => text;
    const line = fitBorder(" left ", " right ", 12, color);

    expect(visibleWidth(line)).toBeLessThanOrEqual(12);
    expect(line.startsWith("─")).toBeTrue();
    expect(line.endsWith("─")).toBeTrue();
  });
});

describe("parseGitStatusPorcelain", () => {
  const output = [
    "# branch.oid 1111111111111111111111111111111111111111",
    "# branch.head feature/x",
    "# branch.ab +2 -1",
    "# stash 3",
    "1 .M N... 100644 100644 100644 aaa bbb modified.txt",
    "1 M. N... 100644 100644 100644 aaa bbb staged.txt",
    "1 D. N... 100644 100644 100644 aaa bbb gone.txt",
    "2 R. N... 100644 100644 100644 aaa bbb R100 new.txt\told.txt",
    "? untracked.txt",
    "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.txt",
    "",
  ].join("\n");

  test("reads branch, ahead/behind and the stash header", () => {
    const status = parseGitStatusPorcelain(output);
    expect(status.branch).toBe("feature/x");
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(1);
    expect(status.stashed).toBeTrue();
  });

  test("counts each porcelain entry kind once", () => {
    const status = parseGitStatusPorcelain(output);
    expect(status.modified).toBe(1);
    expect(status.staged).toBe(1);
    expect(status.deleted).toBe(1);
    expect(status.renamed).toBe(1);
    expect(status.untracked).toBe(1);
    expect(status.conflicted).toBe(1);
    expect(status.typechanged).toBe(0);
  });

  test("treats a detached HEAD and an empty stash as absent", () => {
    const status = parseGitStatusPorcelain(
      ["# branch.head (detached)", "# stash 0", ""].join("\n"),
    );
    expect(status.branch).toBeUndefined();
    expect(status.stashed).toBeFalse();
  });

  test("returns an empty summary for a non-repository", () => {
    const status = parseGitStatusPorcelain("");
    expect(status.branch).toBeUndefined();
    expect(status.modified).toBe(0);
    expect(status.untracked).toBe(0);
  });
});

describe("renderZoneContent", () => {
  const theme = { fg: (color, text) => `<${color}>${text}</${color}>`, bold: (text) => text };
  const state = {
    activity: "running",
    running: true,
    destroyed: false,
    turnIndex: 1,
    modelLabel: "m",
    providerLabel: "p",
    contextPercent: 42,
    contextWindow: 200000,
    totals: { input: 1000, output: 500, cost: 0.4 },
    thinkingLevel: "",
    currentTool: "",
    toolStartedAt: undefined,
    tpsLabel: "0",
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
  };

  test("does not walk the session: totals come from state", () => {
    let scans = 0;
    const ctx = {
      cwd: "/tmp/x",
      getContextUsage: () => undefined,
      sessionManager: {
        getEntries: () => {
          scans += 1;
          return [];
        },
      },
    };
    const config = {
      separator: " · ",
      contextBarStyle: "blocks",
      components: [
        { id: "tokens", enabled: true, zone: "bottom-right" },
        { id: "cost", enabled: true, zone: "bottom-right" },
        { id: "context", enabled: true, zone: "bottom-right" },
      ],
    };
    const line = renderZoneContent(config, state, ctx, theme, "bottom-right");
    expect(scans).toBe(0);
    expect(line).toContain("↑1.0k ↓500");
    expect(line).toContain("$0.400");
    expect(line).toContain("42%/200k");
  });

  test("keeps at most one decimal on the context percent", () => {
    const config = {
      separator: " · ",
      contextBarStyle: "blocks",
      components: [{ id: "context", enabled: true, zone: "bottom-right" }],
    };
    const noisy = { ...state, contextPercent: 1.6966819763183594, contextWindow: 1048576 };
    expect(renderZoneContent(config, noisy, {}, theme, "bottom-right")).toContain("1.7%/1049k");
  });

  test("colours a terminal style and keeps a theme colour alongside bold", () => {
    const config = {
      separator: " · ",
      contextBarStyle: "blocks",
      components: [{ id: "runtime", enabled: true, zone: "top-left" }],
    };
    const swift = { ...state, runtime: { name: "swift", symbol: "S", style: "bold bright-red" } };
    expect(renderZoneContent(config, swift, {}, theme, "top-left")).toBe("\x1b[1;91mvia S\x1b[0m");
  });
});

describe("PI_STATUS_DISABLED", () => {
  test("registers nothing when the env flag is set", () => {
    const registered = [];
    const pi = {
      on: (name) => registered.push(name),
      registerCommand: (name) => registered.push(name),
    };
    const previous = process.env.PI_STATUS_DISABLED;
    process.env.PI_STATUS_DISABLED = "true";
    try {
      piStatus(pi);
      expect(registered).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.PI_STATUS_DISABLED;
      else process.env.PI_STATUS_DISABLED = previous;
    }
  });
});

describe("hasRootMarker", () => {
  test("supports literal file markers", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), "{}\n", "utf8");

    expect(hasRootMarker(dir, "package.json")).toBeTrue();
    expect(hasRootMarker(dir, "bun.lock")).toBeFalse();
  });

  test("supports simple wildcard suffix markers", () => {
    const dir = makeTempDir();
    mkdirSync(path.join(dir, "src"));
    writeFileSync(path.join(dir, "app.kt"), "fun main() = Unit\n", "utf8");
    writeFileSync(path.join(dir, "src", "nested.kt"), "fun nested() = Unit\n", "utf8");

    expect(hasRootMarker(dir, "*.kt")).toBeTrue();
    expect(hasRootMarker(dir, "*.lua")).toBeFalse();
  });
});
