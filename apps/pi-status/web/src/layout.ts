import type { ComponentId, PiStatusConfig, Zone } from "../../src/types.ts";

/**
 * The edit model: four ordered lists. A component that is in none of them is turned off.
 *
 * This is a projection of the flat `components` array, not a second source of truth — the
 * terminal border only has four attachment points, so free coordinates cannot be rendered.
 */

export type Layout = Record<Zone, ComponentId[]>;

export const ZONES: Zone[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function emptyLayout(): Layout {
  return { "top-left": [], "top-right": [], "bottom-left": [], "bottom-right": [] };
}

export function toLayout(config: PiStatusConfig): Layout {
  const layout = emptyLayout();
  for (const component of config.components) {
    if (!component.enabled) continue;
    layout[component.zone].push(component.id);
  }
  return layout;
}

/**
 * Flatten back for the server. Zone order must match the render order, and every component
 * must be emitted: validatePiStatusConfig re-appends anything missing from the defaults, which
 * would silently undo a user's "turned off" choice.
 */
export function toComponents(
  layout: Layout,
  original: PiStatusConfig,
): PiStatusConfig["components"] {
  const out: PiStatusConfig["components"] = [];
  const placed = new Set<ComponentId>();
  for (const zone of ZONES) {
    for (const id of layout[zone]) {
      if (placed.has(id)) continue;
      out.push({ id, enabled: true, zone });
      placed.add(id);
    }
  }
  for (const component of original.components) {
    if (placed.has(component.id)) continue;
    out.push({ id: component.id, enabled: false, zone: component.zone });
  }
  return out;
}

export function findZone(layout: Layout, id: ComponentId): Zone | undefined {
  return ZONES.find((zone) => layout[zone].includes(id));
}

export function enabledIds(layout: Layout): ComponentId[] {
  return ZONES.flatMap((zone) => layout[zone]);
}

/**
 * Move a component to `to` at `index`, or to the tray when `to` is "tray".
 *
 * The source zone is irrelevant: the id is stripped from every zone first, so a repeated or stale
 * drop cannot leave a duplicate copy behind.
 */
export function moveInLayout(
  layout: Layout,
  id: ComponentId,
  to: Zone | "tray",
  index?: number,
): Layout {
  // Strip the id from every zone first. dnd-kit can report the same drop twice and a stale
  // `from` then leaves a copy behind, which shows up as a duplicated module on the border.
  const next: Layout = {
    "top-left": layout["top-left"].filter((item) => item !== id),
    "top-right": layout["top-right"].filter((item) => item !== id),
    "bottom-left": layout["bottom-left"].filter((item) => item !== id),
    "bottom-right": layout["bottom-right"].filter((item) => item !== id),
  };
  if (to === "tray") return next;

  const target = next[to];
  const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, id);
  return next;
}
