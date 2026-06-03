import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import { fitBorder } from "../border.ts";
import { writePiStatusConfig } from "../config.ts";
import { COMPONENT_LABELS, DEFAULT_CONFIG, ZONE_LABELS } from "../constants.ts";
import { renderZoneContent } from "../render.ts";
import type { ComponentConfig, Zone } from "../types.ts";
import type { CommandContext } from "./context.ts";

const ZONES: Zone[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export async function handleComponents(
  cmdCtx: CommandContext,
  ctx: ExtensionCommandContext,
  _pi: ExtensionAPI,
): Promise<void> {
  // Group components by zone, preserving order within each zone
  const zoneGroups = new Map<Zone, ComponentConfig[]>();
  for (const zone of ZONES) {
    zoneGroups.set(zone, []);
  }
  for (const comp of cmdCtx.config.components) {
    zoneGroups.get(comp.zone)?.push({ ...comp });
  }
  // Ensure all component IDs from DEFAULT_CONFIG are present
  const allIds = new Set([...zoneGroups.values()].flat().map((c) => c.id));
  for (const comp of DEFAULT_CONFIG.components) {
    if (!allIds.has(comp.id)) {
      zoneGroups.get(comp.zone)?.push({ ...comp });
    }
  }

  // Cursor position: zone index + item index within that zone
  let zoneIdx = 0;
  let itemIdx = 0;

  // Flatten zone groups back to a flat array for saving
  function toComponentsArray(): ComponentConfig[] {
    const result: ComponentConfig[] = [];
    for (const zone of ZONES) {
      const items = zoneGroups.get(zone);
      if (items) result.push(...items);
    }
    return result;
  }

  // Get items for a zone safely
  function getZoneItems(zone: Zone): ComponentConfig[] {
    return zoneGroups.get(zone) ?? [];
  }

  // Ensure cursor points to a valid item in the current zone
  function clampCursor(): void {
    const items = getZoneItems(ZONES[zoneIdx]);
    if (items.length === 0) {
      itemIdx = 0;
      return;
    }
    if (itemIdx >= items.length) itemIdx = items.length - 1;
    if (itemIdx < 0) itemIdx = 0;
  }

  // Move cursor to the nearest zone that has items
  function moveToZoneWithItems(direction: -1 | 1): void {
    let next = zoneIdx + direction;
    while (next >= 0 && next < ZONES.length) {
      const nextItems = getZoneItems(ZONES[next]);
      if (nextItems.length > 0) {
        zoneIdx = next;
        itemIdx = direction === 1 ? 0 : nextItems.length - 1;
        return;
      }
      next += direction;
    }
  }

  // Reorder within the current zone
  function reorderWithinZone(offset: -1 | 1): void {
    const items = getZoneItems(ZONES[zoneIdx]);
    const nextIndex = itemIdx + offset;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    [items[itemIdx], items[nextIndex]] = [items[nextIndex], items[itemIdx]] as [
      ComponentConfig,
      ComponentConfig,
    ];
    itemIdx = nextIndex;
  }

  // Move selected component to an adjacent zone
  function moveComponentToZone(targetZoneIdx: number): void {
    if (targetZoneIdx < 0 || targetZoneIdx >= ZONES.length) return;
    const currentItems = getZoneItems(ZONES[zoneIdx]);
    if (currentItems.length === 0) return;
    const [moved] = currentItems.splice(itemIdx, 1);
    moved.zone = ZONES[targetZoneIdx];
    const targetItems = getZoneItems(ZONES[targetZoneIdx]);
    targetItems.push(moved);
    zoneIdx = targetZoneIdx;
    itemIdx = targetItems.length - 1;
  }

  await ctx.ui.custom((tui, theme, _kb, done) => {
    const container = new Container();

    // Preview: show actual rendered zone content with real border rendering
    // This mirrors PiStatusEditor.render() to give a faithful preview
    function preview(width: number): string[] {
      const previewWidth = Math.min(width, 80);
      const innerWidth = Math.max(1, previewWidth - 2);
      const borderColor = (text: string) => theme.fg("dim", text);

      const tempComponents = toComponentsArray();
      const previous = cmdCtx.config.components;
      cmdCtx.config.components = tempComponents;

      const topLeft = renderZoneContent(cmdCtx.config, cmdCtx.state, ctx, theme, "top-left");
      const topRight = renderZoneContent(cmdCtx.config, cmdCtx.state, ctx, theme, "top-right");
      const bottomLeft = renderZoneContent(cmdCtx.config, cmdCtx.state, ctx, theme, "bottom-left");
      const bottomRight = renderZoneContent(
        cmdCtx.config,
        cmdCtx.state,
        ctx,
        theme,
        "bottom-right",
      );

      cmdCtx.config.components = previous;

      const tl = topLeft ? ` ${topLeft} ` : "";
      const tr = topRight ? ` ${topRight} ` : "";
      const bl = bottomLeft ? ` ${bottomLeft} ` : "";
      const br = bottomRight ? ` ${bottomRight} ` : "";

      // Top border row: ╭─ tl ─── tr ─╮
      const topRow = `${borderColor("╭")}${fitBorder(tl, tr, innerWidth, borderColor)}${borderColor("╮")}`;

      // Middle content rows (show 2 blank rows with side borders)
      const side = borderColor("│");
      const blank = " ".repeat(innerWidth);
      const midRows = [`${side}${blank}${side}`, `${side}${blank}${side}`];

      // Bottom border row: ╰─ bl ─── br ─╯
      const bottomRow = `${borderColor("╰")}${fitBorder(bl, br, innerWidth, borderColor)}${borderColor("╯")}`;

      return [topRow, ...midRows, bottomRow];
    }

    function rebuild() {
      container.clear();

      // Preview section
      container.addChild(new Text(theme.fg("dim", "Preview:"), 1, 0));
      for (const line of preview(80)) {
        container.addChild(new Text(line, 1, 0));
      }
      container.addChild(new Text("", 0, 0));

      // Component list grouped by zone
      const maxLabelWidth = Math.max(...Object.values(COMPONENT_LABELS).map((l) => l.length));

      for (const [zi, zone] of ZONES.entries()) {
        const items = getZoneItems(zone);
        const isActiveZone = zi === zoneIdx;

        // Zone header
        const header = isActiveZone
          ? theme.fg("accent", `▸ ${ZONE_LABELS[zone]}`)
          : theme.fg("dim", `  ${ZONE_LABELS[zone]}`);
        container.addChild(new Text(header, 1, 0));

        // Components within this zone
        for (const [ii, component] of items.entries()) {
          const isCursor = zi === zoneIdx && ii === itemIdx;
          const marker = isCursor ? "›" : " ";
          const checked = component.enabled ? "✓" : " ";
          const label = COMPONENT_LABELS[component.id].padEnd(maxLabelWidth);
          const line = `    ${marker} [${checked}] ${label}`;
          container.addChild(new Text(isCursor ? theme.fg("accent", line) : line, 1, 0));
        }

        if (items.length === 0) {
          container.addChild(new Text(theme.fg("dim", "      (empty)"), 1, 0));
        }
      }

      container.addChild(
        new Text(
          theme.fg("dim", "↑↓ navigate  Space toggle  ←→ zone  Ctrl+↑/↓ reorder  Enter/Esc save"),
          1,
          0,
        ),
      );
      tui.requestRender();
    }

    clampCursor();
    rebuild();

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        const currentItems = getZoneItems(ZONES[zoneIdx]);

        if (matchesKey(data, Key.up)) {
          if (itemIdx > 0) {
            itemIdx--;
          } else if (zoneIdx > 0) {
            // Move to previous zone's last item
            moveToZoneWithItems(-1);
          }
        } else if (matchesKey(data, Key.down)) {
          if (itemIdx < currentItems.length - 1) {
            itemIdx++;
          } else if (zoneIdx < ZONES.length - 1) {
            // Move to next zone's first item
            moveToZoneWithItems(1);
          }
        } else if (matchesKey(data, Key.space)) {
          const item = currentItems[itemIdx];
          if (item) item.enabled = !item.enabled;
        } else if (matchesKey(data, Key.left)) {
          // Move component to previous zone
          moveComponentToZone(zoneIdx - 1);
        } else if (matchesKey(data, Key.right)) {
          // Move component to next zone
          moveComponentToZone(zoneIdx + 1);
        } else if (matchesKey(data, Key.ctrl("up"))) {
          // Reorder within current zone: move up
          reorderWithinZone(-1);
        } else if (matchesKey(data, Key.ctrl("down"))) {
          // Reorder within current zone: move down
          reorderWithinZone(1);
        } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter)) {
          cmdCtx.config.components = toComponentsArray();
          writePiStatusConfig(cmdCtx.config);
          cmdCtx.syncAnimation();
          cmdCtx.requestRender();
          done(undefined);
          return;
        }

        clampCursor();
        rebuild();
      },
    };
  });
  ctx.ui.notify("Component settings updated", "info");
}
