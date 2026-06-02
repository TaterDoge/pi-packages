import type { ComponentRenderInput } from "./type.ts";

export function renderCostComponent({ state }: ComponentRenderInput): string {
  return state.costLabel;
}
