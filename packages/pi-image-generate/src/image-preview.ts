import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { GeneratedImage } from "./types.ts";

export async function openImagePreview(images: GeneratedImage[]): Promise<boolean> {
  if (images.length === 0) return false;
  const directory = await mkdtemp(path.join(tmpdir(), "pi-image-preview-"));
  const previewPath = path.join(directory, "index.html");
  await writeFile(previewPath, buildImagePreviewHtml(images), "utf8");
  const opened = await openBrowser(pathToFileURL(previewPath).href);
  if (!opened) await rm(directory, { recursive: true, force: true });
  else setTimeout(() => void rm(directory, { recursive: true, force: true }), 5 * 60_000).unref();
  return opened;
}

export function buildImagePreviewHtml(images: GeneratedImage[]): string {
  const figures = images
    .map(
      (image) => `<figure>
<img src="${escapeHtml(pathToFileURL(image.path).href)}" alt="${escapeHtml(path.basename(image.path))}">
<figcaption>${escapeHtml(image.path)}</figcaption>
</figure>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Generated image preview</title>
<style>
  :root { color-scheme: dark; font: 14px system-ui, sans-serif; background: #111; color: #ddd; }
  body { margin: 0; padding: 24px; }
  main { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 24px; }
  figure { margin: 0; overflow: hidden; border: 1px solid #333; border-radius: 12px; background: #191919; }
  img { display: block; width: 100%; height: auto; max-height: calc(100vh - 90px); object-fit: contain; background: #0a0a0a; }
  figcaption { padding: 12px; overflow-wrap: anywhere; color: #aaa; }
</style>
<main>${figures}</main>
</html>`;
}

export function openBrowser(url: string): Promise<boolean> {
  let command = "xdg-open";
  let args = [url];
  if (process.platform === "darwin") command = "open";
  else if (process.platform === "win32") {
    command = "rundll32";
    args = ["url.dll,FileProtocolHandler", url];
  }
  return new Promise((resolve) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
    child.once("error", () => resolve(false));
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}
