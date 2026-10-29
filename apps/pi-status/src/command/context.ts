import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PiStatusConfig } from "../types.ts";

export interface CommandContext {
  config: PiStatusConfig;
  requestRender: () => void;
  syncAnimation: () => void;
  installWidget: (ctx: ExtensionContext) => void;
  lastCtx: ExtensionContext | undefined;
}
