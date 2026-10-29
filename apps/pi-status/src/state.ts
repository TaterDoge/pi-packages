import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { emptyGitStatus } from "./components/git.ts";
import { EMPTY_TOTALS, readSessionTotals } from "./session-totals.ts";
import type { RuntimeHandles, RuntimeState } from "./types.ts";

export function createRuntimeState(): RuntimeState {
  return {
    ...emptyGitStatus(),
    activity: "idle",
    running: false,
    destroyed: false,
    turnIndex: 0,
    modelLabel: "no-model",
    providerLabel: "",
    contextPercent: undefined,
    contextWindow: undefined,
    totals: { ...EMPTY_TOTALS },
    thinkingLevel: "",
    currentTool: "",
    toolStartedAt: undefined,
    tpsLabel: "0 tok/s",
    runtime: undefined,
    spinnerIndex: 0,
  };
}

export function createRuntimeHandles(): RuntimeHandles {
  return {
    staleTimer: undefined,
    staleInterval: undefined,
    projectTimer: undefined,
    spinnerInterval: undefined,
  };
}

/**
 * Refresh everything that comes from the session, not from the clock.
 * Called on lifecycle events only: it walks the session entries once for the totals.
 */
export function syncInteractiveState(
  state: RuntimeState,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): void {
  const usage = ctx.getContextUsage();
  state.modelLabel = ctx.model?.id ?? "no-model";
  state.providerLabel = ctx.model?.provider ?? "";
  state.contextPercent = usage?.percent ?? undefined;
  state.contextWindow = ctx.model?.contextWindow ?? usage?.contextWindow;
  state.totals = readSessionTotals(ctx);
  try {
    state.thinkingLevel = pi.getThinkingLevel() ?? "";
  } catch {
    state.thinkingLevel = "";
  }
}
