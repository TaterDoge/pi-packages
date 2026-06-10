import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Text, visibleWidth } from "@earendil-works/pi-tui";
import { renderContextComponent } from "../components/context.ts";
import { getDefaultPiStatusConfig, writePiStatusConfig } from "../config.ts";
import { CONTEXT_BAR_STYLES } from "../constants.ts";
import type { ContextBarStyleId } from "../types.ts";
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

export async function handleContextBarStyle(
  cmdCtx: CommandContext,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const styleIds = Object.keys(CONTEXT_BAR_STYLES) as ContextBarStyleId[];
  let cursor = Math.max(0, styleIds.indexOf(cmdCtx.config.contextBarStyle));

  const selected = await ctx.ui.custom<ContextBarStyleId | undefined>((tui, theme, _kb, done) => {
    const container = new Container();

    function buildPreview(styleId: ContextBarStyleId): string {
      const previewConfig = { ...cmdCtx.config, contextBarStyle: styleId };
      const previewState = { ...cmdCtx.state, contextLabel: "67%/256k" };
      return renderContextComponent({
        state: previewState,
        ctx,
        theme,
        config: previewConfig,
      });
    }

    function rebuild(): void {
      container.clear();
      container.addChild(new Text("Choose context bar style", 1, 0));
      container.addChild(new Text("", 0, 0));

      for (const [index, styleId] of styleIds.entries()) {
        const selectedStyle = index === cursor;
        const marker = selectedStyle ? theme.fg("accent", "›") : " ";
        const label = CONTEXT_BAR_STYLES[styleId].label;
        const line = `${marker} ${label.padEnd(8)} ${buildPreview(styleId)}`;
        container.addChild(new Text(selectedStyle ? theme.fg("accent", line) : line, 1, 0));
      }

      container.addChild(new Text("", 0, 0));
      container.addChild(new Text(theme.fg("dim", "↑↓ navigate  Enter save  Esc cancel"), 1, 0));
      tui.requestRender();
    }

    rebuild();
    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, Key.up)) cursor = Math.max(0, cursor - 1);
        else if (matchesKey(data, Key.down)) cursor = Math.min(styleIds.length - 1, cursor + 1);
        else if (matchesKey(data, Key.escape)) {
          done(undefined);
          return;
        } else if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
          done(styleIds[cursor]);
          return;
        }
        rebuild();
      },
    };
  });

  if (!selected || selected === cmdCtx.config.contextBarStyle) return;
  cmdCtx.config.contextBarStyle = selected;
  writePiStatusConfig(cmdCtx.config);
  cmdCtx.requestRender();
  ctx.ui.notify("Context bar style updated", "info");
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
