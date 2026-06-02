import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { getDefaultPiStatusConfig, writePiStatusConfig } from "../config.ts";
import type { CommandContext } from "./context.ts";

export async function handleSeparator(
  cmdCtx: CommandContext,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const next = await ctx.ui.input(
    `Current separator: "${cmdCtx.config.separator}". Enter new separator:`,
    cmdCtx.config.separator,
  );
  if (next === undefined) return;
  if (visibleWidth(next) > 8) {
    ctx.ui.notify("Separator too long (max display width 8)", "error");
    return;
  }
  cmdCtx.config.separator = next;
  writePiStatusConfig(cmdCtx.config);
  cmdCtx.requestRender();
  ctx.ui.notify("Separator updated", "info");
}

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
