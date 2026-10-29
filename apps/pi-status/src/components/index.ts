import type { ComponentId } from "../types.ts";
import { renderContextComponent } from "./context.ts";
import { renderCostComponent } from "./cost.ts";
import { renderCurrentToolComponent } from "./current-tool.ts";
import { renderCwdComponent } from "./cwd.ts";
import { renderGitComponent } from "./git.ts";
import { renderModelComponent } from "./model.ts";
import { renderRuntimeComponent } from "./runtime.ts";
import { renderStatusComponent } from "./status.ts";
import { renderThinkingComponent } from "./thinking.ts";
import { renderTokensComponent } from "./tokens.ts";
import { renderTpsComponent } from "./tps.ts";
import { renderTurnComponent } from "./turn.ts";
import type { ComponentRenderer } from "./type.ts";

// Keep this map in the same order as ComponentId/ALL_COMPONENT_IDS.
export const COMPONENT_RENDERERS: Record<ComponentId, ComponentRenderer> = {
  status: renderStatusComponent,
  cwd: renderCwdComponent,
  git: renderGitComponent,
  runtime: renderRuntimeComponent,
  cost: renderCostComponent,
  model: renderModelComponent,
  thinking: renderThinkingComponent,
  context: renderContextComponent,
  tokens: renderTokensComponent,
  turn: renderTurnComponent,
  current_tool: renderCurrentToolComponent,
  tps: renderTpsComponent,
};
