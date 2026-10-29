import {
  CustomEditor,
  type ExtensionContext,
  type KeybindingsManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { type EditorTheme, type TUI, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { fitBorder } from "./border.ts";
import { renderZoneContent } from "./render.ts";
import type { PiStatusConfig, RuntimeState } from "./types.ts";

/**
 * PiStatusEditor extends CustomEditor to add zone-based border decorations
 * following the Osdy-Pi border decoration protocol.
 *
 * The editor is wrapped with:
 *   ╭─ top-left ─── top-right ─╮
 *   │  [original editor lines]  │
 *   ╰─ bottom-left ─── bottom-right ─╯
 *
 * Each zone collects its assigned status modules and renders them
 * into the top or bottom border row using fitBorder().
 */
export class PiStatusEditor extends CustomEditor {
  private readonly piStatusConfig: PiStatusConfig;
  private readonly piStatusState: RuntimeState;
  private readonly piCtx: ExtensionContext;
  private readonly piTheme: Theme;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    config: PiStatusConfig,
    state: RuntimeState,
    ctx: ExtensionContext,
    themeRef: Theme,
  ) {
    super(tui, theme, keybindings, { paddingX: 1 });
    this.piStatusConfig = config;
    this.piStatusState = state;
    this.piCtx = ctx;
    this.piTheme = themeRef;
  }

  override render(width: number): string[] {
    if (this.piStatusState.destroyed) return super.render(width);

    // Progressive degradation: too narrow for borders or autocomplete is showing
    if (width < 4 || this.isShowingAutocomplete()) return super.render(width);

    const editorWidth = width;
    const innerWidth = Math.max(1, editorWidth - 2);
    const lines = super.render(innerWidth);

    if (lines.length < 2) return lines;

    let bottomIndex = Math.max(1, lines.length - 1);

    // Ensure minimum internal lines (like Osdy-Pi)
    const target = this.tui.terminal.rows < 18 ? 3 : 4;
    const internalLines = bottomIndex - 1;
    if (internalLines < target) {
      const blank = " ".repeat(innerWidth);
      const added = Array.from({ length: target - internalLines }, () => blank);
      lines.splice(bottomIndex, 0, ...added);
      bottomIndex += added.length;
    }

    // Apply side borders to each content line
    const borderColor = (text: string) => this.borderColor(text);
    const side = borderColor("│");
    for (let index = 1; index < bottomIndex; index += 1) {
      const content = truncateToWidth(lines[index] ?? "", innerWidth, "");
      const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
      lines[index] = `${side}${content}${padding}${side}`;
    }

    // Build top border row with top-left and top-right zone content
    const topLeft = this.renderStyledZoneContent("top-left");
    const topRight = this.renderStyledZoneContent("top-right");
    lines[0] = `${borderColor("╭")}${fitBorder(topLeft, topRight, editorWidth - 2, borderColor)}${borderColor("╮")}`;

    // Build bottom border row with bottom-left and bottom-right zone content
    const bottomLeft = this.renderStyledZoneContent("bottom-left");
    const bottomRight = this.renderStyledZoneContent("bottom-right");
    lines[bottomIndex] =
      `${borderColor("╰")}${fitBorder(bottomLeft, bottomRight, editorWidth - 2, borderColor)}${borderColor("╯")}`;

    return lines;
  }

  /**
   * Render zone content with a styled separator prefix.
   * The prefix adds a space before and after the zone content
   * so it doesn't sit directly on the border corner.
   */
  private renderStyledZoneContent(
    zone: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  ): string {
    const content = renderZoneContent(
      this.piStatusConfig,
      this.piStatusState,
      this.piCtx,
      this.piTheme,
      zone,
    );
    return content ? ` ${content} ` : "";
  }
}

/**
 * Factory function that creates a PiStatusEditor.
 * This should be passed to ctx.ui.setEditorComponent().
 */
export function createPiStatusEditorFactory(
  config: PiStatusConfig,
  state: RuntimeState,
  ctx: ExtensionContext,
  themeRef: Theme,
  onTui?: (requestRender: () => void) => void,
) {
  return (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
    onTui?.(() => tui.requestRender());
    return new PiStatusEditor(tui, theme, keybindings, config, state, ctx, themeRef);
  };
}
