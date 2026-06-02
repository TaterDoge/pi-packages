import type { ComponentRenderInput } from "./type.ts";

export function renderModelComponent({ state }: ComponentRenderInput): string {
  return `${state.providerLabel}/${state.modelLabel}`;
}
