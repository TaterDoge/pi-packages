/**
 * Shared shadcn/ui surface for Pi extensions that ship a browser page.
 *
 * Deliberately small: this package owns *presentation only* — component source, theme
 * helpers, and the Tailwind stylesheet. Each extension keeps its own page, routes, and
 * server because "how should this extension look" is not something a shared layer can answer.
 */
export { applyTheme, initialTheme, THEME_STORAGE_KEY, type Theme } from "./lib/theme.ts";
