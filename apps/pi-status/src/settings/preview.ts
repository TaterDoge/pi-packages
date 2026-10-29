import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { fitBorder } from "../border.ts";
import { COMPONENT_RENDERERS } from "../components/index.ts";
import { collectZoneSegments, joinZoneSegments } from "../render.ts";
import type { PiStatusConfig, RuntimeState, Zone } from "../types.ts";
import type { ConfigPayload, PreviewPayload } from "./protocol.ts";

/**
 * Preview mirrors PiStatusEditor.render() for the two border rows, so the browser shows
 * exactly what the terminal draws — including fitBorder's truncation order.
 */

export type PreviewInput = {
  config: PiStatusConfig;
  width: number;
  state: RuntimeState;
  ctx: ExtensionContext;
  theme: Pick<Theme, "fg" | "bold">;
};

const ESCAPE = String.fromCharCode(27);
const SGR = new RegExp(`${ESCAPE}\\[[0-9;]*m`, "g");

/** Strip SGR escapes so a segment can be used as a DOM label. */
export function plainText(value: string): string {
  return value.replace(SGR, "");
}

function borderRow(input: PreviewInput, left: Zone, right: Zone): string {
  const { config, state, ctx, theme, width } = input;
  const leftContent = joinZoneSegments(
    config,
    theme,
    collectZoneSegments(config, state, ctx, theme, left),
  );
  const rightContent = joinZoneSegments(
    config,
    theme,
    collectZoneSegments(config, state, ctx, theme, right),
  );
  const paint = (text: string) => theme.fg("borderMuted" as ThemeColor, text);
  // Same shape as PiStatusEditor.render: corners are outside fitBorder's width budget.
  const corners = left.startsWith("top") ? ["╭", "╮"] : ["╰", "╯"];
  const inner = fitBorder(
    leftContent ? ` ${leftContent} ` : "",
    rightContent ? ` ${rightContent} ` : "",
    Math.max(0, width - 2),
    paint,
  );
  return `${paint(corners[0])}${inner}${paint(corners[1])}`;
}

export function renderPreview(input: PreviewInput): PreviewPayload {
  const width = Math.max(2, Math.round(input.width));
  return {
    top: borderRow(input, "top-left", "top-right"),
    bottom: borderRow(input, "bottom-left", "bottom-right"),
    width,
  };
}

/**
 * One sample per component id, using the live runtime state. Disabled components still get a
 * sample so the tray can show what the user would be re-enabling.
 */
export function collectSamples(input: PreviewInput): Record<string, string> {
  const samples: Record<string, string> = {};
  for (const component of input.config.components) {
    const rendered = COMPONENT_RENDERERS[component.id]({
      state: input.state,
      ctx: input.ctx,
      theme: input.theme,
      config: input.config,
    });
    samples[component.id] = plainText(rendered);
  }
  return samples;
}

export function buildConfigPayload(
  input: Omit<PreviewInput, "config" | "width"> & {
    config: PiStatusConfig;
    defaults: PiStatusConfig;
    targetPath: string;
    maxSeparatorWidth: number;
    contextBarStyles: ConfigPayload["contextBarStyles"];
  },
): ConfigPayload {
  return {
    config: input.config,
    defaults: input.defaults,
    samples: collectSamples({ ...input, config: input.config, width: 0 }),
    contextBarStyles: input.contextBarStyles,
    meta: {
      title: "pi-status",
      subtitle: "Drag modules onto the border to set their order. Empty zones collapse away.",
      targetPath: input.targetPath,
      maxSeparatorWidth: input.maxSeparatorWidth,
    },
  };
}
