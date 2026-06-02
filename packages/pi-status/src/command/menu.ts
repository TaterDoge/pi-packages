import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import { handleReset, handleSeparator } from "./actions.ts";
import { handleComponents } from "./components.ts";
import type { CommandContext } from "./context.ts";

type MenuAction = "components" | "separator" | "reset" | "close";

export async function showMenu(
  cmdCtx: CommandContext,
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
): Promise<void> {
  const action = await ctx.ui.custom<MenuAction>((tui, theme, _kb, done) => {
    let cursor = 0;
    const container = new Container();
    const items: Array<{ action: MenuAction; label: () => string }> = [
      { action: "components", label: () => "Change components" },
      { action: "separator", label: () => "Change separator" },
      { action: "reset", label: () => "Reset to defaults" },
      { action: "close", label: () => "Close" },
    ];

    function rebuild() {
      container.clear();
      container.addChild(new Text("pi-status (above Editor)", 1, 0));
      container.addChild(new Text("", 0, 0));
      for (const [index, item] of items.entries()) {
        const selected = index === cursor;
        const marker = selected ? theme.fg("accent", "›") : " ";
        const label = selected ? theme.fg("accent", item.label()) : item.label();
        container.addChild(new Text(`  ${marker} ${label}`, 1, 0));
      }
      tui.requestRender();
    }

    rebuild();
    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, Key.up)) cursor = Math.max(0, cursor - 1);
        else if (matchesKey(data, Key.down)) cursor = Math.min(items.length - 1, cursor + 1);
        else if (matchesKey(data, Key.escape)) done("close");
        else if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
          const item = items[cursor];
          if (!item) return;
          if (item.action === "close") done("close");
          else done(item.action);
          return;
        }
        rebuild();
      },
    };
  });

  if (action === "components") return handleComponents(cmdCtx, ctx, pi);
  if (action === "separator") return handleSeparator(cmdCtx, ctx);
  if (action === "reset") return handleReset(cmdCtx, ctx);
}
