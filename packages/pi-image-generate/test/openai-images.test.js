import { describe, expect, test } from "bun:test";
import { openAiImagesProtocol, parseOpenAiImagesResponse } from "../src/protocols/openai-images.ts";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const limits = {
  requestTimeoutMs: 1000,
  pollIntervalMs: 1,
  maxPollAttempts: 2,
  maxResponseBytes: 100000,
  maxImageBytes: 100000,
  maxInputImages: 8,
  maxOutputImages: 8,
};
function context(fetchImpl, overrides = {}, inputs = []) {
  return {
    providerId: "studio",
    provider: { baseUrl: "https://example.test/v1", protocol: "openai-images" },
    model: {
      provider: "studio",
      id: "flux",
      capabilities: { imageInput: "multiple", n: true, size: true, qualityValues: ["high"] },
      protocolOverrides: overrides,
    },
    params: { prompt: "a cat", n: 2, size: "1024x1024", quality: "high" },
    inputs,
    apiKey: "secret",
    headers: { "X-Custom": "header-secret" },
    fetchImpl,
    limits,
  };
}

describe("openai-images protocol", () => {
  test("parses URL and base64 results", () => {
    expect(
      parseOpenAiImagesResponse({
        data: [
          { url: "https://cdn.test/a.png", revised_prompt: "better cat" },
          { b64_json: PNG.toString("base64"), media_type: "image/png" },
        ],
      }),
    ).toEqual([
      { data: { kind: "url", url: "https://cdn.test/a.png" }, revisedPrompt: "better cat" },
      { data: { kind: "base64", bytes: PNG.toString("base64"), mimeType: "image/png" } },
    ]);
  });

  test("sends JSON generation parameters and bearer auth", async () => {
    let request;
    const fetchImpl = async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }), {
        headers: { "content-type": "application/json" },
      });
    };
    await openAiImagesProtocol.generate(context(fetchImpl));
    expect(request.url).toBe("https://example.test/v1/images/generations");
    expect(request.init.headers.authorization).toBe("Bearer secret");
    expect(request.body).toMatchObject({
      model: "flux",
      prompt: "a cat",
      n: 2,
      size: "1024x1024",
      quality: "high",
    });
  });

  test("uses multipart edit with repeated image fields", async () => {
    let request;
    const fetchImpl = async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }), {
        headers: { "content-type": "application/json" },
      });
    };
    await openAiImagesProtocol.generate(
      context(fetchImpl, { editMode: "multipart" }, [
        { bytes: PNG, mimeType: "image/png" },
        { bytes: PNG, mimeType: "image/png" },
      ]),
    );
    expect(request.url).toBe("https://example.test/v1/images/edits");
    expect(request.init.body).toBeInstanceOf(FormData);
    expect(request.init.body.getAll("image[]")).toHaveLength(2);
  });

  test("supports a configurable JSON reference image field", async () => {
    let body;
    const fetchImpl = async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }), {
        headers: { "content-type": "application/json" },
      });
    };
    await openAiImagesProtocol.generate(
      context(
        fetchImpl,
        {
          referenceField: "input_references",
          imageFieldMode: "objects",
          imageObjectField: "image_url",
        },
        [{ bytes: PNG, mimeType: "image/png" }],
      ),
    );
    expect(body.input_references[0].image_url).toStartWith("data:image/png;base64,");
  });
});
