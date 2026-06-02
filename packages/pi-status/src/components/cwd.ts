import type { ComponentRenderInput } from "./type.ts";

export function renderCwdComponent({ ctx }: ComponentRenderInput): string {
  const cwd = ctx.cwd || process.cwd();
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  return `󰝰 ${normalized.split("/").filter(Boolean).at(-1) ?? cwd}`;
}
