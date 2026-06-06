import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { UsageCostTotals } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

const EMPTY_COST: Readonly<UsageCostTotals> = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
};

type AssistantCostEntry = SessionEntry & {
  type: "message";
  message: {
    role: "assistant";
    usage?: {
      cost?: Partial<UsageCostTotals>;
    };
  };
};

function isAssistantCostEntry(entry: SessionEntry): entry is AssistantCostEntry {
  return entry.type === "message" && entry.message.role === "assistant";
}

function addCostTotals(totals: UsageCostTotals, cost: Partial<UsageCostTotals> = EMPTY_COST): void {
  totals.input += cost.input ?? 0;
  totals.output += cost.output ?? 0;
  totals.cacheRead += cost.cacheRead ?? 0;
  totals.cacheWrite += cost.cacheWrite ?? 0;
  totals.total += cost.total ?? 0;
}

function getUsageCostTotals(ctx: ExtensionContext): UsageCostTotals {
  const totals = { ...EMPTY_COST };

  for (const entry of ctx.sessionManager.getEntries().filter(isAssistantCostEntry)) {
    addCostTotals(totals, entry.message.usage?.cost);
  }

  return totals;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.000";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 10) return `$${value.toFixed(2)}`;
  return `$${Math.round(value)}`;
}

export function renderCostComponent({ ctx }: ComponentRenderInput): string {
  return formatUsd(getUsageCostTotals(ctx).total);
}
