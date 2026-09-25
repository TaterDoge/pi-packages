import { beforeEach, describe, expect, test } from "bun:test";
import { applyTheme, initialTheme, THEME_STORAGE_KEY } from "../web/src/lib/theme.ts";

let classes;
let style;
let store;

beforeEach(() => {
  classes = new Set();
  style = {};
  store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
  };
  globalThis.document = {
    documentElement: {
      classList: {
        toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
      },
      style,
    },
  };
});

describe("settings page theme", () => {
  test("defaults to dark", () => {
    expect(initialTheme()).toBe("dark");
  });

  test("restores a stored light theme", () => {
    store.set(THEME_STORAGE_KEY, "light");
    expect(initialTheme()).toBe("light");
  });

  test("applies and persists both themes", () => {
    applyTheme("light");
    expect(classes.has("dark")).toBe(false);
    expect(style.colorScheme).toBe("light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");

    applyTheme("dark");
    expect(classes.has("dark")).toBe(true);
    expect(style.colorScheme).toBe("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
  });
});
