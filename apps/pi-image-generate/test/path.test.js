import { describe, expect, test } from "bun:test";
import { getPath, maskPaths, restoreMasked, setPath, uniqueKey } from "../src/settings/path.ts";

const MASK = "••••••••";

describe("dotted paths", () => {
  test("reads and writes through objects and arrays", () => {
    const value = { a: { b: [{ c: 1 }] } };
    expect(getPath(value, "a.b.0.c")).toBe(1);
    expect(getPath(value, "a.missing.c")).toBeUndefined();
    const next = setPath(value, "a.b.0.c", 2);
    expect(getPath(next, "a.b.0.c")).toBe(2);
    expect(getPath(value, "a.b.0.c")).toBe(1);
  });

  test("creates missing intermediate objects", () => {
    expect(setPath({}, "a.b.c", 3)).toEqual({ a: { b: { c: 3 } } });
  });
});

describe("secret masking", () => {
  const settings = {
    providers: {
      studio: {
        credential: { source: "literal", value: "secret-value" },
        headers: [{ name: "x-key", value: { source: "literal", value: "header-secret" } }],
      },
    },
    outputDir: "out",
  };
  const patterns = ["providers.*.credential.value", "providers.*.headers.*.value.value"];

  test("masks only matching leaves", () => {
    const masked = maskPaths(settings, patterns, MASK);
    expect(getPath(masked, "providers.studio.credential.value")).toBe(MASK);
    expect(getPath(masked, "providers.studio.headers.0.value.value")).toBe(MASK);
    expect(getPath(masked, "providers.studio.credential.source")).toBe("literal");
    expect(getPath(masked, "outputDir")).toBe("out");
  });

  test("restores unchanged masked values and keeps edits", () => {
    const masked = maskPaths(settings, patterns, MASK);
    const restored = restoreMasked(masked, settings, patterns, MASK);
    expect(restored).toEqual(settings);

    const edited = { ...masked, outputDir: "generated" };
    expect(getPath(restoreMasked(edited, settings, patterns, MASK), "outputDir")).toBe("generated");

    const replaced = structuredClone(masked);
    replaced.providers.studio.credential.value = "new-secret";
    expect(
      getPath(
        restoreMasked(replaced, settings, patterns, MASK),
        "providers.studio.credential.value",
      ),
    ).toBe("new-secret");
  });
});

describe("uniqueKey", () => {
  test("appends a counter that does not collide", () => {
    expect(uniqueKey({}, "provider")).toBe("provider");
    expect(uniqueKey({ provider: {} }, "provider")).toBe("provider1");
    expect(uniqueKey({ provider: {}, provider1: {} }, "provider")).toBe("provider2");
  });
});
