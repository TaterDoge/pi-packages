import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { SessionTotals } from "./types.ts";

export const EMPTY_TOTALS: Readonly<SessionTotals> = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  cost: 0,
};

type AssistantEntry = SessionEntry & {
  type: "message";
  message: {
    role: "assistant";
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: { total?: number };
    };
  };
};

function isAssistantEntry(entry: SessionEntry): entry is AssistantEntry {
  return entry.type === "message" && entry.message.role === "assistant";
}

/**
 * Tokens and cost in a single pass over the session.
 *
 * Called on message events, never from render: `getEntries()` copies the whole entry list, so
 * per-frame calls would walk (and allocate) the entire session on every frame.
 */
export function readSessionTotals(ctx: ExtensionContext): SessionTotals {
  const totals: SessionTotals = { ...EMPTY_TOTALS };

  // Match Pi's built-in footer: use every persisted session entry, not only
  // the active branch. This keeps totals stable after branching/compaction.
  for (const entry of ctx.sessionManager.getEntries()) {
    if (!isAssistantEntry(entry)) continue;
    const usage = entry.message.usage;
    if (!usage) continue;
    totals.input += usage.input ?? 0;
    totals.output += usage.output ?? 0;
    totals.cacheRead += usage.cacheRead ?? 0;
    totals.cacheWrite += usage.cacheWrite ?? 0;
    totals.cost += usage.cost?.total ?? 0;
  }

  return totals;
}

export function formatUsageCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.000";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 10) return `$${value.toFixed(2)}`;
  return `$${Math.round(value)}`;
}
