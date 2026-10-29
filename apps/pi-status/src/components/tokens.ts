import { formatUsageCount } from "../session-totals.ts";
import type { ComponentRenderInput } from "./type.ts";

export function renderTokensComponent({ state }: ComponentRenderInput): string {
  return `↑${formatUsageCount(state.totals.input)} ↓${formatUsageCount(state.totals.output)}`;
}
