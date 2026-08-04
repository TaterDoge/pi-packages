import { describe, expect, test } from "bun:test";
import {
  geminiGenerateContentProtocol,
  parseGeminiResponse,
} from "../src/protocols/gemini-generate-content.ts";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const B64 = PNG.toString("base64");
const limits = {
  requestTimeoutMs: 1000,
  pollIntervalMs: 1,
  maxPollAttempts: 2,
  maxResponseBytes: 100000,
  maxImageBytes: 100000,
  maxInputImages: 8,
  maxOutputImages: 8,
};

describe("gemini-generate-content protocol", () => {
  test("parses camelCase and snake_case inline image responses", () => {
    expect(
      parseGeminiResponse({
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { mimeType: "image/png", data: B64 } },
                { inline_data: { mime_type: "image/jpeg", data: B64 } },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      { data: { kind: "base64", bytes: B64, mimeType: "image/png" } },
      { data: { kind: "base64", bytes: B64, mimeType: "image/jpeg" } },
    ]);
  });

  test("sends prompt and multiple image parts", async () => {
    let request;
    const fetchImpl = async (url, init) => {
      request = { url, headers: init.headers, body: JSON.parse(init.body) };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: B64 } }] } }] }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const result = await geminiGenerateContentProtocol.generate({
      providerId: "gemini-proxy",
      provider: { baseUrl: "https://gemini.test/v1beta", protocol: "gemini-generate-content" },
      model: {
        provider: "gemini-proxy",
        id: "gemini-image",
        capabilities: { imageInput: "multiple", n: true, size: true, qualityValues: [] },
      },
      params: { prompt: "edit this", n: 2 },
      inputs: [
        { bytes: PNG, mimeType: "image/png" },
        { bytes: PNG, mimeType: "image/png" },
      ],
      apiKey: "secret",
      headers: {},
      fetchImpl,
      limits,
    });
    expect(request.url).toBe("https://gemini.test/v1beta/models/gemini-image:generateContent");
    expect(request.headers["x-goog-api-key"]).toBe("secret");
    expect(request.body.contents[0].parts).toHaveLength(3);
    expect(request.body.contents[0].parts[2]).toEqual({ text: "edit this" });
    expect(request.body.generationConfig.candidateCount).toBe(2);
    expect(result).toHaveLength(1);
  });

  test("fails when no image was returned", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "refused" }] } }] }),
    ).toThrow("no usable image");
  });
});
