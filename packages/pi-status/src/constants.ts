import type { ActivityState, ComponentId, PiStatusConfig, Zone } from "./types.ts";

export const STALE_REFRESH_INTERVAL_MS = 1000;
export const PROJECT_REFRESH_INTERVAL_MS = 30_000;
export const TOOL_STALE_AFTER_MS = 30_000;
export const SPINNER_INTERVAL_MS = 250;

export const ZONE_IDS: readonly Zone[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const ZONE_LABELS: Record<Zone, string> = {
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
};

export const ALL_COMPONENT_IDS = [
  "status",
  "cwd",
  "git",
  "runtime",
  "model",
  "thinking",
  "context",
  "tokens",
  "turn",
  "current_tool",
  "tps",
] as const satisfies readonly ComponentId[];

export const COMPONENT_LABELS: Record<ComponentId, string> = {
  status: "Activity state",
  cwd: "Working directory",
  git: "Git branch and status",
  runtime: "Detected project runtime",
  model: "Current model",
  thinking: "Thinking level",
  context: "Context usage",
  tokens: "Input/output token totals",
  turn: "Current turn number",
  current_tool: "Currently executing tool",
  tps: "Tokens per second",
};

export const DEFAULT_CONFIG: PiStatusConfig = {
  separator: " · ",
  components: [
    { id: "status", enabled: true, zone: "top-left" },
    { id: "cwd", enabled: true, zone: "top-left" },
    { id: "turn", enabled: true, zone: "top-left" },
    { id: "current_tool", enabled: true, zone: "top-left" },
    { id: "git", enabled: true, zone: "top-left" },
    { id: "runtime", enabled: true, zone: "top-left" },
    { id: "model", enabled: true, zone: "bottom-left" },
    { id: "thinking", enabled: true, zone: "bottom-left" },
    { id: "tps", enabled: true, zone: "bottom-left" },
    { id: "tokens", enabled: true, zone: "bottom-right" },
    { id: "context", enabled: true, zone: "bottom-right" },
  ],
};

export const STATUS_STYLES: Record<ComponentId | "separator", string> = {
  status: "accent",
  cwd: "bold cyan",
  git: "bold purple",
  runtime: "bold green",
  model: "bold blue",
  thinking: "bold yellow",
  context: "green",
  tokens: "bright-black",
  turn: "bright-black",
  current_tool: "bold cyan",
  tps: "bold green",
  separator: "bright-black",
};

export const SPINNER_FRAMES: Record<ActivityState, readonly string[]> = {
  idle: ["󰄯"],
  running: ["◐", "◓", "◑", "◒"],
  tool: [""],
  error: [""],
  stale: ["", "", ""],
};

export const ACTIVITY_THEME_COLORS: Record<ActivityState, string> = {
  idle: "success",
  running: "accent",
  tool: "warning",
  error: "error",
  stale: "warning",
};
