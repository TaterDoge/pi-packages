import type { ComponentRenderInput } from "./type.ts";

export function renderThinkingComponent({ state }: ComponentRenderInput): string {
  return state.thinkingLevel ?? "";
}
