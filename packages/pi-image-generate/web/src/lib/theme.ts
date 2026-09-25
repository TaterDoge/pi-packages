export const THEME_STORAGE_KEY = "pi-image-generate-theme";

export type Theme = "light" | "dark";

/** The settings page is dark unless the user has switched it. */
export function initialTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
