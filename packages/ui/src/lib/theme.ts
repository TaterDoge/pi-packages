export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pi-ui-theme";

export function initialTheme(): Theme {
  const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Dark is the extension-settings default; only an explicit light preference flips it.
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches === false
    ? "light"
    : "dark";
}

export function applyTheme(theme: Theme): void {
  const root = globalThis.document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
}
