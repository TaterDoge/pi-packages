import type {
  ActivityState,
  ComponentId,
  ContextBarStyleId,
  PiStatusConfig,
  Zone,
} from "./types.ts";

export const STALE_REFRESH_INTERVAL_MS = 1000;
export const PROJECT_REFRESH_INTERVAL_MS = 30_000;
/** Floor between two git polls: a busy turn fires tool_execution_end far faster than this. */
export const PROJECT_REFRESH_MIN_GAP_MS = 1000;
export const TOOL_STALE_AFTER_MS = 30_000;
export const SPINNER_INTERVAL_MS = 250;

/** Display-column ceiling for the separator; the TUI prompt and the web page share it. */
export const MAX_SEPARATOR_WIDTH = 8;

export const ZONE_IDS: readonly Zone[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const ALL_COMPONENT_IDS = [
  "status",
  "cwd",
  "git",
  "runtime",
  "cost",
  "model",
  "thinking",
  "context",
  "tokens",
  "turn",
  "current_tool",
  "tps",
] as const satisfies readonly ComponentId[];

export const CONTEXT_BAR_STYLES: Record<
  ContextBarStyleId,
  { label: string; filled: string; track: string }
> = {
  blocks: { label: "Blocks", filled: "◼", track: "◻" },
  lines: { label: "Lines", filled: "━", track: "─" },
};

export const DEFAULT_CONFIG: PiStatusConfig = {
  separator: " · ",
  contextBarStyle: "blocks",
  components: [
    { id: "status", enabled: true, zone: "top-left" },
    { id: "cwd", enabled: true, zone: "top-left" },
    { id: "turn", enabled: true, zone: "top-left" },
    { id: "current_tool", enabled: true, zone: "top-left" },
    { id: "git", enabled: true, zone: "top-left" },
    { id: "runtime", enabled: true, zone: "top-left" },
    { id: "cost", enabled: true, zone: "top-right" },
    { id: "model", enabled: true, zone: "bottom-left" },
    { id: "thinking", enabled: true, zone: "bottom-left" },
    { id: "tps", enabled: true, zone: "bottom-left" },
    { id: "tokens", enabled: true, zone: "bottom-right" },
    { id: "context", enabled: true, zone: "bottom-right" },
  ],
};

export const STATUS_STYLES: Record<ComponentId | "separator", string> = {
  status: "",
  cwd: "bold cyan",
  git: "bold purple",
  runtime: "bold green",
  cost: "bold green",
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
