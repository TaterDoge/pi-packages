import type { RuntimeState } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

// ── Renderer ───────────────────────────────────────────────

export function renderTpsComponent({ state }: ComponentRenderInput): string {
  return state.tpsLabel;
}

// ── Minimal structural types for event payloads ─────────────

type AssistantMessageLike = {
  role: string;
  usage?: { output?: number };
};

type DeltaLike = { type: string; delta?: string };

type MessageStartLike = { message: AssistantMessageLike };
type MessageUpdateLike = { message: AssistantMessageLike; assistantMessageEvent: DeltaLike };
type MessageEndLike = { message: AssistantMessageLike };

// ── TPS Tracker (pure logic, no event registration) ───────

/** Timestamp when the current agent run started. Used for final elapsed display. */
let agentStart: number | null = null;
/** Timestamp when the current assistant message event started. Used as a fallback. */
let messageStart: number | null = null;
/** Timestamp of the first streamed output delta for the current assistant message. */
let streamStart: number | null = null;
/** Estimated streamed output tokens for live display before providers report final usage. */
let estimatedStreamedTokens = 0;
/** Cumulative official output tokens across all assistant messages in this agent run. */
let totalOutputTokens = 0;
/** Cumulative time (ms) spent actually streaming output deltas. */
let totalStreamMs = 0;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${totalSeconds}s`;
}

/** Reset TPS state for a new agent run. Call from agent_start handler. */
export function onAgentStart(state: RuntimeState): void {
  agentStart = Date.now();
  totalOutputTokens = 0;
  totalStreamMs = 0;
  messageStart = null;
  streamStart = null;
  estimatedStreamedTokens = 0;
  state.tpsLabel = "0 tok/s";
}

/** Track assistant message start. Call from message_start handler. */
export function onMessageStart(event: MessageStartLike): void {
  if (event.message.role !== "assistant") return;
  messageStart = Date.now();
  streamStart = null;
  estimatedStreamedTokens = 0;
}

/** Track streaming deltas and update live TPS. Call from message_update handler. */
export function onMessageUpdate(
  event: MessageUpdateLike,
  state: RuntimeState,
  requestRender: () => void,
): void {
  if (event.message.role !== "assistant") return;

  const streamEvent = event.assistantMessageEvent;
  const isOutputDelta =
    streamEvent.type === "text_delta" ||
    streamEvent.type === "thinking_delta" ||
    streamEvent.type === "toolcall_delta";

  if (!isOutputDelta || streamEvent.delta === undefined) return;

  const now = Date.now();
  streamStart ??= now;
  estimatedStreamedTokens += Math.max(0, streamEvent.delta.length / 4);

  const elapsed = (now - streamStart) / 1000;
  const officialTokens = event.message.usage?.output ?? 0;
  const currentTokens = officialTokens > 0 ? officialTokens : estimatedStreamedTokens;

  if (elapsed > 0 && currentTokens > 0) {
    const tps = Math.round(currentTokens / elapsed);
    state.tpsLabel = `${tps} tok/s`;
    requestRender();
  }
}

/** Accumulate TPS totals from completed assistant message. Call from message_end handler. */
export function onMessageEnd(event: MessageEndLike): void {
  if (event.message.role !== "assistant") return;

  const messageTokens = event.message.usage?.output ?? 0;
  const timingStart = streamStart ?? messageStart;
  if (timingStart && messageTokens > 0) {
    totalOutputTokens += messageTokens;
    totalStreamMs += Math.max(0, Date.now() - timingStart);
  }

  messageStart = null;
  streamStart = null;
  estimatedStreamedTokens = 0;
}

/** Compute final TPS for the agent run. Call from agent_end handler. */
export function onAgentEnd(state: RuntimeState): void {
  const elapsed = totalStreamMs / 1000;
  const tps = totalOutputTokens > 0 && elapsed > 0 ? Math.round(totalOutputTokens / elapsed) : 0;
  const conversationElapsed = agentStart ? formatElapsed(Date.now() - agentStart) : "0s";
  state.tpsLabel = `${tps} tok/s ${conversationElapsed}`;
  agentStart = null;
}
