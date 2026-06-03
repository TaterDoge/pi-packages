import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { emptyGitStatus } from "./components/git.ts";
import { formatUsageCount } from "./components/usage.ts";
import type { RuntimeHandles, RuntimeState } from "./types.ts";

export function createRuntimeState(): RuntimeState {
  return {
    ...emptyGitStatus(),
    activity: "idle",
    running: false,
    destroyed: false,
    turnIndex: 0,
    modelLabel: "no-model",
    providerLabel: "Unknown",
    contextLabel: "--",
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

export function syncInteractiveState(
  state: RuntimeState,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): void {
  state.modelLabel = ctx.model?.id ?? "no-model";
  state.providerLabel = ctx.model?.provider ?? "";
  state.contextLabel = buildContextLabel(ctx);
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
  return `${percent}/${formatUsageCount(contextWindow)}`;
}
