export type Zone = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type ComponentId =
  | "status"
  | "cwd"
  | "git"
  | "runtime"
  | "model"
  | "thinking"
  | "context"
  | "tokens"
  | "turn"
  | "current_tool"
  | "tps";

export type ActivityState = "idle" | "running" | "tool" | "error" | "stale";

export type ComponentConfig = {
  id: ComponentId;
  enabled: boolean;
  zone: Zone;
};

export type PiStatusConfig = {
  separator: string;
  components: ComponentConfig[];
};
export type UsageTotals = {
  input: number;
  output: number;
};

export type RuntimeHandles = {
  staleTimer: ReturnType<typeof setTimeout> | undefined;
  staleInterval: ReturnType<typeof setInterval> | undefined;
  projectTimer: ReturnType<typeof setInterval> | undefined;
  spinnerInterval: ReturnType<typeof setInterval> | undefined;
};

export type RuntimeInfo = {
  name: string;
  symbol: string;
  style: string;
  version?: string;
};

export type GitStatusSummary = {
  branch?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  conflicted: number;
  untracked: number;
  stashed: boolean;
  modified: number;
  staged: number;
  renamed: number;
  deleted: number;
  typechanged: number;
};

export type RuntimeState = GitStatusSummary & {
  activity: ActivityState;
  running: boolean;
  destroyed: boolean;
  turnIndex: number;
  modelLabel: string;
  providerLabel: string;
  contextLabel: string;
  thinkingLevel: string;
  currentTool: string;
  toolStartedAt: number | undefined;
  tpsLabel: string;
  runtime?: RuntimeInfo;
  spinnerIndex: number;
};
