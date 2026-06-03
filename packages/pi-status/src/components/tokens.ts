import type { ComponentRenderInput } from "./type.ts";
import { formatUsageCount, getUsageTotals } from "./usage.ts";

export function renderTokensComponent({ ctx }: ComponentRenderInput): string {
  const totals = getUsageTotals(ctx);
  return `↑${formatUsageCount(totals.input)} ↓${formatUsageCount(totals.output)}`;
}
