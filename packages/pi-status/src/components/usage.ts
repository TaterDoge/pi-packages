import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { UsageTotals } from "../types.ts";

export function formatUsageCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
}

type AssistantMessageEntry = SessionEntry & {
  type: "message";
  message: {
    role: "assistant";
    usage?: Partial<UsageTotals>;
  };
};

function isAssistantMessageEntry(entry: SessionEntry): entry is AssistantMessageEntry {
  return entry.type === "message" && entry.message.role === "assistant";
}

const EMPTY_USAGE: Readonly<UsageTotals> = { input: 0, output: 0 };

function addUsageTotals(totals: UsageTotals, usage: Partial<UsageTotals> = EMPTY_USAGE): void {
  const { input = 0, output = 0 } = usage;
  totals.input += input;
  totals.output += output;
}

export function getUsageTotals(ctx: ExtensionContext): UsageTotals {
  const totals = { input: 0, output: 0 };

  // Match Pi's built-in footer: use every persisted session entry, not only
  // the active branch. This keeps totals stable after branching/compaction.
  for (const entry of ctx.sessionManager.getEntries().filter(isAssistantMessageEntry)) {
    addUsageTotals(totals, entry.message.usage);
  }

  return totals;
}
