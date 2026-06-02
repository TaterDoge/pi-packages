import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantUsageMessage, RuntimeState, UsageTotals } from "./types.ts";

function formatCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
}

function getUsageTotals(ctx: ExtensionContext): UsageTotals {
  let input = 0;
  let output = 0;
  let cost = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const message = entry.message as AssistantUsageMessage;
    input += message.usage?.input ?? 0;
    output += message.usage?.output ?? 0;
    cost += message.usage?.cost?.total ?? 0;
  }

  return { input, output, cost };
}

export function syncInteractiveState(
  state: RuntimeState,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): void {
  const totals = getUsageTotals(ctx);
  state.modelLabel = ctx.model?.id ?? "no-model";
  state.providerLabel = ctx.model?.provider ?? "";
  state.contextLabel = buildContextLabel(ctx);
  state.tokenLabel = `↑${formatCount(totals.input)} ↓${formatCount(totals.output)}`;
  state.costLabel = `$${totals.cost.toFixed(3)}`;
  try {
    state.thinkingLevel = pi.getThinkingLevel() ?? "";
  } catch {
    state.thinkingLevel = "";
  }
}

function buildContextLabel(ctx: ExtensionContext): string {
  const usage = ctx.getContextUsage();
  const contextWindow = ctx.model?.contextWindow ?? usage?.contextWindow;
  if (!usage || !contextWindow || contextWindow <= 0) return "--";

  const percent =
    usage.percent === null || usage.percent === undefined
      ? "?"
      : `${Math.max(0, Math.min(999, Math.round(usage.percent)))}%`;
  return `${percent}/${formatCount(contextWindow)}`;
}
