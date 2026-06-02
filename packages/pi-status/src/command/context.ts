import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PiStatusConfig, RuntimeState } from "../types.ts";

export interface CommandContext {
  config: PiStatusConfig;
  state: RuntimeState;
  requestRender: () => void;
  syncAnimation: () => void;
  installWidget: (ctx: ExtensionContext) => void;
  refreshProjectState: (ctx: ExtensionContext) => Promise<void>;
  lastCtx: ExtensionContext | undefined;
}
