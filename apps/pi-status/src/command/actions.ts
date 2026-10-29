import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getDefaultPiStatusConfig, writePiStatusConfig } from "../config.ts";
import type { CommandContext } from "./context.ts";

/** The only TUI-side write left: everything else is edited in the browser layout editor. */
export async function handleReset(
  cmdCtx: CommandContext,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const ok = await ctx.ui.confirm(
    "Reset pi-status config?",
    "This restores the status bar border defaults around the Editor.",
  );
  if (!ok) return;
  cmdCtx.config = getDefaultPiStatusConfig();
  writePiStatusConfig(cmdCtx.config);
  if (cmdCtx.lastCtx) cmdCtx.installWidget(cmdCtx.lastCtx);
  cmdCtx.syncAnimation();
  cmdCtx.requestRender();
  ctx.ui.notify("pi-status config reset", "info");
}
