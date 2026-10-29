import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { type CommandContext, handleReset } from "./command/index.ts";
import { readGitStatus } from "./components/git.ts";
import { readRuntimeInfo } from "./components/runtime.ts";
import {
  onAgentEnd as tpsOnAgentEnd,
  onAgentStart as tpsOnAgentStart,
  onMessageEnd as tpsOnMessageEnd,
  onMessageStart as tpsOnMessageStart,
  onMessageUpdate as tpsOnMessageUpdate,
} from "./components/tps.ts";
import {
  getDefaultPiStatusConfig,
  isComponentEnabled,
  readPiStatusConfig,
  resolvePiStatusConfigPath,
  writePiStatusConfig,
} from "./config.ts";
import {
  CONTEXT_BAR_STYLES,
  MAX_SEPARATOR_WIDTH,
  PROJECT_REFRESH_INTERVAL_MS,
  PROJECT_REFRESH_MIN_GAP_MS,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  STALE_REFRESH_INTERVAL_MS,
  TOOL_STALE_AFTER_MS,
} from "./constants.ts";
import { createPiStatusEditorFactory } from "./editor.ts";
import { buildConfigPayload, renderPreview } from "./settings/preview.ts";
import { openBrowser, type SettingsServer, startSettingsServer } from "./settings/server.ts";
import { createRuntimeHandles, createRuntimeState, syncInteractiveState } from "./state.ts";
import type { PiStatusConfig } from "./types.ts";

/** README documents PI_STATUS_DISABLED as the way to load pi without this extension. */
function isDisabledByEnv(): boolean {
  const value = process.env.PI_STATUS_DISABLED?.toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export default function piStatus(pi: ExtensionAPI) {
  if (isDisabledByEnv()) return;

  let config: PiStatusConfig = readPiStatusConfig();
  let lastCtx: ExtensionContext | undefined;
  let requestWidgetRender: (() => void) | undefined;
  let projectRefreshInFlight = false;
  let projectRefreshPending = false;
  let lastProjectRefreshAt = 0;
  let projectRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  let settingsServer: SettingsServer | undefined;

  const state = createRuntimeState();
  const handles = createRuntimeHandles();

  function requestRender() {
    requestWidgetRender?.();
  }

  /**
   * One refresh per PROJECT_REFRESH_MIN_GAP_MS at most: message_end, every tool end and the timer
   * all ask for one, and each costs a git process. Extras collapse into a single trailing refresh.
   */
  async function refreshProjectState(ctx: ExtensionContext) {
    if (projectRefreshInFlight) {
      projectRefreshPending = true;
      return;
    }
    const waited = Date.now() - lastProjectRefreshAt;
    if (waited < PROJECT_REFRESH_MIN_GAP_MS) {
      projectRefreshTimer ??= setTimeout(() => {
        projectRefreshTimer = undefined;
        void refreshProjectState(ctx);
      }, PROJECT_REFRESH_MIN_GAP_MS - waited);
      return;
    }

    lastProjectRefreshAt = Date.now();
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
    if (handles.projectTimer) clearInterval(handles.projectTimer);
    handles.projectTimer = setInterval(
      () => void refreshProjectState(ctx),
      PROJECT_REFRESH_INTERVAL_MS,
    );
  }

  function clearStaleTimer(): void {
    if (handles.staleTimer) {
      clearTimeout(handles.staleTimer);
      handles.staleTimer = undefined;
    }
    if (handles.staleInterval) {
      clearInterval(handles.staleInterval);
      handles.staleInterval = undefined;
    }
  }

  function startStaleTimer(): void {
    clearStaleTimer();
    handles.staleTimer = setTimeout(() => {
      if (state.destroyed || state.activity !== "tool") return;
      state.activity = "stale";
      state.spinnerIndex = 0;
      syncAnimation();
      requestRender();
      handles.staleInterval = setInterval(() => {
        if (state.activity !== "stale") {
          clearStaleTimer();
          return;
        }
        requestRender();
      }, STALE_REFRESH_INTERVAL_MS);
    }, TOOL_STALE_AFTER_MS);
  }

  function clearSpinner(): void {
    if (handles.spinnerInterval) {
      clearInterval(handles.spinnerInterval);
      handles.spinnerInterval = undefined;
    }
    state.spinnerIndex = 0;
  }

  function syncAnimation(): void {
    clearSpinner();
    const frames = SPINNER_FRAMES[state.activity];
    const animatesStatus = Boolean(frames && frames.length > 1);
    if (!animatesStatus) return;
    handles.spinnerInterval = setInterval(() => {
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
    requestRender,
    syncAnimation,
    installWidget: installEditor,
    get lastCtx() {
      return lastCtx;
    },
  };

  pi.on("session_start", async (_event, ctx) => {
    if (state.destroyed) return;
    config = readPiStatusConfig();
    state.sessionStartedAt = Date.now();
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
    requestRender();
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
    if (handles.projectTimer) clearInterval(handles.projectTimer);
    handles.projectTimer = undefined;
    if (projectRefreshTimer) clearTimeout(projectRefreshTimer);
    projectRefreshTimer = undefined;
    await settingsServer?.close();
    settingsServer = undefined;
    requestRender();
  });

  /**
   * Browser layout editor. The page only sees the 4 zone lists; the real border output is
   * rendered here with the same fitBorder path as the editor, so what it shows is what the
   * terminal draws.
   */
  async function openSettings(ctx: ExtensionCommandContext) {
    if (!lastCtx?.hasUI) {
      ctx.ui.notify("Start a session with a UI first.", "error");
      return;
    }
    const theme = lastCtx.ui.theme;
    const editingCtx = lastCtx;

    await settingsServer?.close();
    settingsServer = await startSettingsServer({
      save: (next) => writePiStatusConfig(next),
      payload: () =>
        buildConfigPayload({
          config,
          defaults: getDefaultPiStatusConfig(),
          state,
          ctx: editingCtx,
          theme,
          targetPath: resolvePiStatusConfigPath(),
          maxSeparatorWidth: MAX_SEPARATOR_WIDTH,
          contextBarStyles: Object.entries(CONTEXT_BAR_STYLES).map(([id, style]) => ({
            id,
            label: style.label,
          })),
        }),
      preview: (draft, width) =>
        renderPreview({ config: draft, width, state, ctx: editingCtx, theme }),
    });

    const active = settingsServer;
    void openBrowser(active.url);
    ctx.ui.notify(`pi-status layout opened in your browser.\n${active.url}`, "info");

    // Never await the page here: a command handler that blocks keeps the TUI from running
    // any other command, so `/pi-status help` would be dead until the page answered.
    void active.result
      .then((saved) => {
        if (settingsServer === active) settingsServer = undefined;
        if (!saved) {
          requestRender();
          return;
        }

        // The editor factory closes over `config`, so reload then reinstall or the zones never change.
        config = readPiStatusConfig();
        if (lastCtx) installEditor(lastCtx);
        syncAnimation();
        requestRender();
        ctx.ui.notify("pi-status layout applied.", "info");
      })
      .catch((error: Error) => ctx.ui.notify(`pi-status reload failed: ${error.message}`, "error"));
  }

  pi.registerCommand("pi-status", {
    description: "Open the browser layout editor. Subcommands: settings, reset, help.",
    getArgumentCompletions: (prefix) => {
      const normalized = prefix.toLowerCase();
      if (normalized.includes(" ")) return null;
      const head = normalized.trim();
      return STATUS_SUBCOMMANDS.filter((command) => command.name.startsWith(head)).map(
        (command) => ({
          label: command.name,
          value: command.name,
          description: command.description,
        }),
      );
    },
    handler: async (args, ctx) => {
      const [sub] = args.trim().toLowerCase().split(/\s+/);
      if (sub === "reset") return handleReset(cmdCtx, ctx);
      if (sub === "help") return ctx.ui.notify(helpText(), "info");
      // Layout, separator and context bar are all edited in the browser page now,
      // so `/pi-status` and `/pi-status settings` do the same thing.
      return openSettings(ctx);
    },
  });
}

/** Order matters: it is the order the completion menu shows. */
const STATUS_SUBCOMMANDS = [
  { name: "settings", description: "Open the browser layout editor" },
  { name: "reset", description: "Restore the default configuration" },
  { name: "help", description: "List the available subcommands" },
] as const;

function helpText(): string {
  const lines = ["pi-status — status bar around the Editor", ""];
  for (const command of STATUS_SUBCOMMANDS) {
    lines.push(`  /pi-status ${command.name.padEnd(14)} ${command.description}`);
  }
  return lines.join("\n");
}
