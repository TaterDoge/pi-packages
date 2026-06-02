import type { ComponentRenderInput } from "./type.ts";

export function renderCurrentToolComponent({ state }: ComponentRenderInput): string {
  return state.currentTool ? `⚙ ${state.currentTool}` : "";
}
