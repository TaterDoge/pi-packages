import type { ComponentRenderInput } from "./type.ts";

export function renderTokensComponent({ state }: ComponentRenderInput): string {
  return state.tokenLabel;
}
