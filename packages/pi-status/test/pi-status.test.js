// fallow-ignore-file unused-file
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { visibleWidth } from "@earendil-works/pi-tui";
import { fitBorder } from "../src/border.ts";
import { hasRootMarker } from "../src/components/runtime.ts";
import { validatePiStatusConfig } from "../src/config.ts";
import { DEFAULT_CONFIG } from "../src/constants.ts";

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
      ],
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
