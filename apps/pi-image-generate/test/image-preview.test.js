import { describe, expect, test } from "bun:test";
import { buildImagePreviewHtml } from "../src/image-preview.ts";

describe("browser image preview", () => {
  test("renders every generated image without exposing paths as HTML", () => {
    const html = buildImagePreviewHtml([
      {
        path: "/tmp/<preview>.png",
        mimeType: "image/png",
        data: "aGVsbG8=",
      },
    ]);

    expect(html).toContain('src="file:///tmp/%3Cpreview%3E.png"');
    expect(html).toContain("/tmp/&lt;preview&gt;.png");
    expect(html).not.toContain("aGVsbG8=");
  });
});
