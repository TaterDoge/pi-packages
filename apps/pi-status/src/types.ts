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
  | "cost"
  | "turn"
  | "current_tool"
  | "tps"
  | "cache"
  | "elapsed";

export type ActivityState = "idle" | "running" | "tool" | "error" | "stale";

export type ComponentConfig = {
  id: ComponentId;
  enabled: boolean;
  zone: Zone;
};

export type ContextBarStyleId = "blocks" | "lines";

/** Token and cost totals for the whole session, from provider-reported usage. */
export type SessionTotals = {
  input: number;
  output: number;
  /** Prompt tokens served from the provider cache. */
  cacheRead: number;
  /** Prompt tokens written into the provider cache. */
  cacheWrite: number;
  cost: number;
};

export type PiStatusConfig = {
  separator: string;
  components: ComponentConfig[];
  contextBarStyle: ContextBarStyleId;
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
  /** undefined when the provider reports no usage. */
  contextPercent: number | undefined;
  contextWindow: number | undefined;
  totals: SessionTotals;
  thinkingLevel: string;
  currentTool: string;
  toolStartedAt: number | undefined;
  tpsLabel: string;
  /** Wall-clock start of this session; undefined until session_start ran. */
  sessionStartedAt: number | undefined;
  runtime?: RuntimeInfo;
  spinnerIndex: number;
};
