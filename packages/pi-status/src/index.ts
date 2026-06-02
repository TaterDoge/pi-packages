import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import {
  type CommandContext,
  handleComponents,
  handleReset,
  handleSeparator,
  showMenu,
} from "./command/index.ts";
import { emptyGitStatus, readGitStatus } from "./components/git.ts";
import { readRuntimeInfo } from "./components/runtime.ts";
import {
  onAgentEnd as tpsOnAgentEnd,
  onAgentStart as tpsOnAgentStart,
  onMessageEnd as tpsOnMessageEnd,
  onMessageStart as tpsOnMessageStart,
  onMessageUpdate as tpsOnMessageUpdate,
} from "./components/tps.ts";
import { isComponentEnabled, migrateLegacyPiStatusConfig, readPiStatusConfig } from "./config.ts";
import {
  PROJECT_REFRESH_INTERVAL_MS,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  STALE_REFRESH_INTERVAL_MS,
  TOOL_STALE_AFTER_MS,
} from "./constants.ts";
import { createPiStatusEditorFactory } from "./editor.ts";
import { syncInteractiveState } from "./state.ts";
import type { PiStatusConfig, RuntimeState } from "./types.ts";

export default function piStatus(pi: ExtensionAPI) {
  let config: PiStatusConfig = readPiStatusConfig();
  let lastCtx: ExtensionContext | undefined;
  let requestWidgetRender: (() => void) | undefined;
  let projectRefreshInFlight = false;
  let projectRefreshPending = false;

  const state: RuntimeState = {
    ...emptyGitStatus(),
    activity: "idle",
    running: false,
    destroyed: false,
    turnIndex: 0,
    modelLabel: "no-model",
    providerLabel: "Unknown",
    contextLabel: "--",
    tokenLabel: "↑0 ↓0",
    costLabel: "$0.000",
    thinkingLevel: "",
    currentTool: "",
    toolStartedAt: undefined,
    tpsLabel: "0 tok/s",
    runtime: undefined,
    staleTimer: undefined,
    staleInterval: undefined,
    projectTimer: undefined,
    spinnerIndex: 0,
    spinnerInterval: undefined,
  };

  function requestRender() {
    requestWidgetRender?.();
  }

  async function refreshProjectState(ctx: ExtensionContext) {
    if (projectRefreshInFlight) {
      projectRefreshPending = true;
      return;
    }
    projectRefreshInFlight = true;
    try {
      const [gitStatus, runtime] = await Promise.all([
        readGitStatus(ctx.cwd),
        isComponentEnabled(config, "runtime")
          ? readRuntimeInfo(ctx.cwd)
          : Promise.resolve(undefined),
      ]);
      Object.assign(state, gitStatus);
      state.runtime = runtime;
    } finally {
      projectRefreshInFlight = false;
      requestRender();
      if (projectRefreshPending && !state.destroyed) {
        projectRefreshPending = false;
        void refreshProjectState(ctx);
      }
    }
  }

  const createStatusOnlyFooter = (
    footerData: ReadonlyFooterDataProvider,
    ctx: ExtensionContext,
  ): Component => ({
    render: (width: number) => {
      const statuses = [...footerData.getExtensionStatuses().values()].filter(Boolean);
      if (statuses.length === 0) return [];

      const separator = ctx.ui.theme.fg("muted", "  ·  ");
      const line = statuses.join(separator);
      return [truncateToWidth(line, Math.max(0, width), "")];
    },
    invalidate: () => {},
  });

  /**
   * Install the PiStatusEditor via setEditorComponent.
   * This decorates the editor with zone-based border decorations
   * following the Osdy-Pi border protocol.
   */
  function installEditor(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;
    lastCtx = ctx;
    ctx.ui.setFooter((_tui, _theme, footerData) => createStatusOnlyFooter(footerData, ctx));
    ctx.ui.setEditorComponent(
      createPiStatusEditorFactory(config, state, ctx, ctx.ui.theme, (requestRender) => {
        requestWidgetRender = requestRender;
      }),
    );
  }

  function startProjectTimer(ctx: ExtensionContext) {
    if (state.projectTimer) clearInterval(state.projectTimer);
    state.projectTimer = setInterval(
      () => void refreshProjectState(ctx),
      PROJECT_REFRESH_INTERVAL_MS,
    );
  }

  function clearStaleTimer(): void {
    if (state.staleTimer) {
      clearTimeout(state.staleTimer);
      state.staleTimer = undefined;
    }
    if (state.staleInterval) {
      clearInterval(state.staleInterval);
      state.staleInterval = undefined;
    }
  }

  function startStaleTimer(): void {
    clearStaleTimer();
    state.staleTimer = setTimeout(() => {
      if (state.destroyed || state.activity !== "tool") return;
      state.activity = "stale";
      state.spinnerIndex = 0;
      syncAnimation();
      requestRender();
      state.staleInterval = setInterval(() => {
        if (state.activity !== "stale") {
          clearStaleTimer();
          return;
        }
        requestRender();
      }, STALE_REFRESH_INTERVAL_MS);
    }, TOOL_STALE_AFTER_MS);
  }

  function clearSpinner(): void {
    if (state.spinnerInterval) {
      clearInterval(state.spinnerInterval);
      state.spinnerInterval = undefined;
    }
    state.spinnerIndex = 0;
  }

  function syncAnimation(): void {
    clearSpinner();
    const frames = SPINNER_FRAMES[state.activity];
    const animatesStatus = Boolean(frames && frames.length > 1);
    if (!animatesStatus) return;
    state.spinnerInterval = setInterval(() => {
      if (state.destroyed) {
        clearSpinner();
        return;
      }
      state.spinnerIndex = (state.spinnerIndex + 1) % 1000;
      requestRender();
    }, SPINNER_INTERVAL_MS);
  }

  const cmdCtx: CommandContext = {
    get config() {
      return config;
    },
    set config(v) {
      config = v;
    },
    state,
    requestRender,
    syncAnimation,
    installWidget: installEditor,
    refreshProjectState,
    get lastCtx() {
      return lastCtx;
    },
  };

  pi.on("session_start", async (_event, ctx) => {
    if (state.destroyed) return;
    migrateLegacyPiStatusConfig();
    config = readPiStatusConfig();
    syncInteractiveState(state, ctx, pi);
    installEditor(ctx);
    syncAnimation();
    await refreshProjectState(ctx);
    startProjectTimer(ctx);
    requestRender();
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (state.destroyed) return;
    state.running = true;
    state.activity = "running";
    state.currentTool = "";
    state.toolStartedAt = undefined;
    tpsOnAgentStart(state);
    clearStaleTimer();
    syncAnimation();
    state.turnIndex = 1;
    syncInteractiveState(state, ctx, pi);
    requestRender();
    await refreshProjectState(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (state.destroyed) return;
    state.running = false;
    state.activity = "idle";
    state.currentTool = "";
    state.toolStartedAt = undefined;
    clearStaleTimer();
    tpsOnAgentEnd(state);
    syncInteractiveState(state, ctx, pi);
    syncAnimation();
    requestRender();
  });

  pi.on("turn_start", async (event, ctx) => {
    if (state.destroyed) return;
    state.activity = state.currentTool ? state.activity : "running";
    state.turnIndex = event.turnIndex;
    syncAnimation();
    syncInteractiveState(state, ctx, pi);
    requestRender();
  });

  pi.on("message_start", async (event) => {
    tpsOnMessageStart(event);
  });

  pi.on("message_update", async (event) => {
    tpsOnMessageUpdate(event, state, requestRender);
  });

  pi.on("message_end", async (event, ctx) => {
    if (state.destroyed) return;
    tpsOnMessageEnd(event);
    syncInteractiveState(state, ctx, pi);
    void refreshProjectState(ctx);
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    if (state.destroyed) return;
    state.activity = "tool";
    state.currentTool = event.toolName;
    state.toolStartedAt = Date.now();
    syncAnimation();
    startStaleTimer();
    requestRender();
  });

  pi.on("tool_execution_update", async (_event, _ctx) => {
    if (state.destroyed) return;
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (state.destroyed) return;
    clearStaleTimer();
    state.activity = event.isError ? "error" : "running";
    state.currentTool = "";
    state.toolStartedAt = undefined;
    syncAnimation();
    requestRender();
    void refreshProjectState(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    if (state.destroyed) return;
    syncInteractiveState(state, ctx, pi);
    requestRender();
  });

  pi.on("thinking_level_select", async (_event, ctx) => {
    if (state.destroyed) return;
    syncInteractiveState(state, ctx, pi);
    requestRender();
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    state.destroyed = true;
    clearStaleTimer();
    clearSpinner();
    if (state.projectTimer) clearInterval(state.projectTimer);
    state.projectTimer = undefined;
    requestRender();
  });

  pi.registerCommand("pi-status", {
    description:
      "Control the status bar around the Editor. Subcommands: components, separator, reset.",
    handler: async (args, ctx) => {
      const [sub] = args.trim().toLowerCase().split(/\s+/);
      if (sub === "components") return handleComponents(cmdCtx, ctx, pi);
      if (sub === "separator") return handleSeparator(cmdCtx, ctx);
      if (sub === "reset") return handleReset(cmdCtx, ctx);
      return showMenu(cmdCtx, ctx, pi);
    },
  });
}

export { getDefaultPiStatusConfig, readPiStatusConfig, writePiStatusConfig } from "./config.ts";
export {
  ALL_COMPONENT_IDS,
  COMPONENT_LABELS,
  DEFAULT_CONFIG,
  ZONE_IDS,
  ZONE_LABELS,
} from "./constants.ts";
export type { ComponentConfig, ComponentId, PiStatusConfig, Zone } from "./types.ts";
