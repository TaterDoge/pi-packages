import { truncateHead } from "@earendil-works/pi-coding-agent";
import type { ImageGenerateResult } from "./types.ts";

export function formatToolResult(result: ImageGenerateResult): string {
  return boundText(
    [
      `Generated ${result.images.length} image(s) with ${result.model}.`,
      "Saved files:",
      ...result.images.map((image) => `  ${image.path}`),
    ].join("\n"),
  );
}

export function formatCommandSummary(result: ImageGenerateResult): string {
  return boundText(
    [
      `Generated ${result.images.length} image(s) with ${result.model}:`,
      ...result.images.map((image) => `  ${image.path}`),
    ].join("\n"),
  );
}

export function boundedDetails(result: ImageGenerateResult): Record<string, unknown> {
  return {
    taskId: result.taskId,
    provider: result.provider,
    model: result.model,
    imageCount: result.images.length,
    paths: result.images.map((image) => image.path).slice(0, 8),
  };
}

function boundText(value: string): string {
  const result = truncateHead(value, { maxBytes: 48 * 1024, maxLines: 1900 });
  return result.truncated ? `${result.content}\n[image output truncated]` : result.content;
}
