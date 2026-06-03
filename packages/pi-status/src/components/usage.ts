import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { UsageTotals } from "../types.ts";

export function formatUsageCount(value: number): string {
  if (value < 1000) return `${value}`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value / 1000)}k`;
}

function isAssistantMessageEntry(entry: SessionEntry): entry is SessionEntry & {
  type: "message";
  message: {
    role: "assistant";
    usage?: {
      input?: number;
      output?: number;
    };
  };
} {
  return entry.type === "message" && entry.message.role === "assistant";
}

export function getUsageTotals(ctx: ExtensionContext): UsageTotals {
  let input = 0;
  let output = 0;

  // Match Pi's built-in footer: use every persisted session entry, not only
  // the active branch. This keeps totals stable after branching/compaction.
  for (const entry of ctx.sessionManager.getEntries()) {
    if (!isAssistantMessageEntry(entry)) continue;
    input += entry.message.usage?.input ?? 0;
    output += entry.message.usage?.output ?? 0;
  }

  return { input, output };
}
