import type { ComponentRenderInput } from "./type.ts";

export function renderTurnComponent({ state }: ComponentRenderInput): string {
  return state.running && state.turnIndex > 0 ? `turn ${state.turnIndex}` : "";
}
