import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { materializeImage, sanitizeFilename, writeUniqueImage } from "../src/files.ts";
import { resolveImageInputs, sniffMime } from "../src/image-input.ts";

const dirs = [];
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const limits = {
  requestTimeoutMs: 1000,
  pollIntervalMs: 1,
  maxPollAttempts: 2,
  maxResponseBytes: 100000,
  maxImageBytes: 100000,
  maxInputImages: 2,
  maxOutputImages: 8,
};
afterEach(async () =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))),
);
async function temp() {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-image-files-"));
  dirs.push(dir);
  return dir;
}

describe("image inputs and files", () => {
  test("resolves a local path and sniffs MIME", async () => {
    const dir = await temp();
    await writeFile(path.join(dir, "input.bin"), PNG);
    const images = await resolveImageInputs(["input.bin"], dir, fetch, limits);
    expect(images[0].mimeType).toBe("image/png");
    expect(sniffMime(PNG)).toBe("image/png");
  });

  test("rejects inline and excessive inputs", async () => {
    await expect(
      resolveImageInputs(["data:image/png;base64,AA=="], "/tmp", fetch, limits),
    ).rejects.toThrow("file paths");
    await expect(resolveImageInputs(["a", "b", "c"], "/tmp", fetch, limits)).rejects.toThrow(
      "At most 2",
    );
  });

  test("downloads a URL result with byte limits", async () => {
    const result = await materializeImage(
      { data: { kind: "url", url: "https://cdn.test/a.png?token=secret" } },
      async () => new Response(PNG, { headers: { "content-type": "image/png" } }),
      limits,
    );
    expect(result.mimeType).toBe("image/png");
    expect(Buffer.from(result.bytes)).toEqual(PNG);
  });

  test("writes unique atomic names and preserves each payload", async () => {
    const dir = await temp();
    const outputs = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        writeUniqueImage(
          dir,
          "../hero.png",
          "image/png",
          Buffer.concat([PNG, Buffer.from([index])]),
        ),
      ),
    );
    expect(new Set(outputs).size).toBe(20);
    expect(outputs.some((output) => output.endsWith("hero.png"))).toBeTrue();
    const lastBytes = new Set(
      await Promise.all(outputs.map(async (file) => (await readFile(file)).at(-1))),
    );
    expect(lastBytes.size).toBe(20);
    expect(sanitizeFilename("../../bad:name.png")).toBe("bad-name");
  });
});
