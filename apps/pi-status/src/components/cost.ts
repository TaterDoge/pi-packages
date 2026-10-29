import { formatUsd } from "../session-totals.ts";
import type { ComponentRenderInput } from "./type.ts";

export function renderCostComponent({ state }: ComponentRenderInput): string {
  return formatUsd(state.totals.cost);
}
