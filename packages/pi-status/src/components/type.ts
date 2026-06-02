import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { RuntimeState } from "../types.ts";

export type ComponentRenderInput = {
  state: RuntimeState;
  ctx: ExtensionContext;
  theme: Pick<Theme, "fg" | "bold">;
};

export type ComponentRenderer = (input: ComponentRenderInput) => string;
