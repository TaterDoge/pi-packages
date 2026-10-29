// fallow-ignore-file unused-file
import { describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG } from "../src/constants.ts";
import { enabledIds, findZone, moveInLayout, toComponents, toLayout } from "../web/src/layout.ts";

describe("toLayout / toComponents", () => {
  test("round-trips the default config without losing components", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    const layout = toLayout(config);
    const back = toComponents(layout, config);
    expect(back.filter((component) => component.enabled)).toHaveLength(enabledIds(layout).length);
    expect(back.map((component) => component.id).sort()).toEqual(
      config.components.map((component) => component.id).sort(),
    );
  });

  test("keeps a turned-off component in the payload as disabled", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    const layout = toLayout(config);
    layout["top-left"] = layout["top-left"].filter((id) => id !== "git");

    const back = toComponents(layout, config);
    const git = back.find((component) => component.id === "git");
    // Dropping the entry entirely would let validatePiStatusConfig re-enable it from defaults.
    expect(git).toEqual({ id: "git", enabled: false, zone: "top-left" });
    expect(back).toHaveLength(config.components.length);
  });

  test("emits zones in render order", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    const back = toComponents(toLayout(config), config);
    const zones = back.filter((component) => component.enabled).map((component) => component.zone);
    const order = ["top-left", "top-right", "bottom-left", "bottom-right"];
    const ranks = zones.map((zone) => order.indexOf(zone));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("drops duplicate ids instead of emitting them twice", () => {
    const config = structuredClone(DEFAULT_CONFIG);
    const layout = toLayout(config);
    layout["top-right"].push("git");

    const back = toComponents(layout, config);
    expect(back.filter((component) => component.id === "git")).toHaveLength(1);
  });
});

describe("moveInLayout", () => {
  const base = () => toLayout(structuredClone(DEFAULT_CONFIG));

  test("reorders inside a zone", () => {
    const layout = base();
    const before = layout["top-left"];
    const moved = moveInLayout(layout, before[0], "top-left", 2);
    expect(moved["top-left"][2]).toBe(before[0]);
    expect(moved["top-left"]).toHaveLength(before.length);
  });

  test("moves across zones and keeps the source intact", () => {
    const layout = base();
    const moved = moveInLayout(layout, "cost", "bottom-left");
    expect(moved["top-right"]).not.toContain("cost");
    expect(moved["bottom-left"].at(-1)).toBe("cost");
    expect(layout["top-right"]).toContain("cost"); // input untouched
  });

  test("turns a component off by moving it to the tray", () => {
    const layout = base();
    const moved = moveInLayout(layout, "git", "tray");
    expect(enabledIds(moved)).not.toContain("git");
    expect(findZone(moved, "git")).toBeUndefined();
  });

  test("turns it back on from the tray", () => {
    const layout = base();
    const off = moveInLayout(layout, "git", "tray");
    const back = moveInLayout(off, "git", "top-right", 0);
    expect(back["top-right"][0]).toBe("git");
  });

  // The drop handler passes the hovered chip's own index; adjacent drops must therefore swap.
  test("inserting at a neighbour's index swaps the two", () => {
    const layout = base();
    const [first, second] = layout["top-left"];
    expect(moveInLayout(layout, first, "top-left", 1)["top-left"].slice(0, 2)).toEqual([
      second,
      first,
    ]);
  });

  test("clamps an out-of-range index", () => {
    const layout = base();
    expect(moveInLayout(layout, "git", "top-left", 999)["top-left"].at(-1)).toBe("git");
    expect(moveInLayout(layout, "git", "top-left", -5)["top-left"][0]).toBe("git");
  });
});

describe("drag gesture safety", () => {
  test("one gesture applies exactly one move, even if replayed", () => {
    const layout = toLayout(structuredClone(DEFAULT_CONFIG));
    const once = moveInLayout(layout, "cost", "bottom-left");
    // dnd-kit can report the same drop twice; the second call must be a no-op.
    const twice = moveInLayout(once, "cost", "bottom-left");
    expect(twice["bottom-left"]).toEqual(once["bottom-left"]);
    expect(twice["bottom-right"]).toEqual(once["bottom-right"]);
  });

  test("a component never appears in two zones", () => {
    let layout = toLayout(structuredClone(DEFAULT_CONFIG));
    for (const [from, to] of [
      ["top-right", "bottom-left"],
      ["top-left", "bottom-right"],
      ["bottom-left", "top-left"],
    ]) {
      const id = layout[from][0];
      if (!id) continue;
      layout = moveInLayout(layout, id, to);
    }
    const all = enabledIds(layout);
    expect(new Set(all).size).toBe(all.length);
  });
});
