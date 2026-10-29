import type { PiStatusConfig } from "../types.ts";

/**
 * Wire types shared by the settings server and the browser page.
 * Keep this file free of node imports so `web/` can import it.
 */

export type ConfigPayload = {
  config: PiStatusConfig;
  /** Shipped defaults, so the page can reset without bundling the constants. */
  defaults: PiStatusConfig;
  /** Current render of every component against the live runtime state. */
  samples: Record<string, string>;
  contextBarStyles: { id: string; label: string }[];
  meta: {
    title: string;
    subtitle: string;
    /** Where Save will write, resolved server-side with the same rule as writePiStatusConfig. */
    targetPath: string;
    maxSeparatorWidth: number;
  };
};

export type PreviewPayload = {
  top: string;
  bottom: string;
  width: number;
};

export type ConfigIssue = { path: string; message: string };
