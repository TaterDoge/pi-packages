import type { ImageProtocol, JsonObject, RawImageResult } from "../types.ts";
import { fetchWithTimeout, joinUrl, readJsonResponse } from "./http.ts";
import { requireImages } from "./output.ts";

export type GeminiOverrides = {
  pathTemplate?: string;
  apiKeyHeader?: string;
  responseModalities?: string[];
  candidateCountField?: string;
  generationConfig?: JsonObject;
};

export const geminiGenerateContentProtocol: ImageProtocol = {
  async generate(context) {
    const providerName = context.provider.name ?? context.providerId;
    const overrides = readOverrides(context.model.protocolOverrides);
    const parts: Array<Record<string, unknown>> = context.inputs.map((input) => ({
      inline_data: {
        mime_type: input.mimeType,
        data: Buffer.from(input.bytes).toString("base64"),
      },
    }));
    parts.push({ text: context.params.prompt });
    const generationConfig: Record<string, unknown> = {
      responseModalities: overrides.responseModalities ?? ["IMAGE"],
      candidateCount: context.params.n ?? 1,
      ...(context.model.defaults ?? {}),
      ...(overrides.generationConfig ?? {}),
    };
    if (context.params.size) generationConfig.imageConfig = { imageSize: context.params.size };
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig,
    };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...context.headers,
    };
    if (context.apiKey) headers[overrides.apiKeyHeader ?? "x-goog-api-key"] = context.apiKey;
    const endpoint = (overrides.pathTemplate ?? "models/{model}:generateContent").replace(
      "{model}",
      encodeURIComponent(context.model.id),
    );
    context.onPhase?.("requesting", `Requesting image from ${providerName}`);
    const response = await fetchWithTimeout(
      context.fetchImpl,
      joinUrl(context.provider.baseUrl, endpoint),
      { method: "POST", headers, body: JSON.stringify(body) },
      context.limits.requestTimeoutMs,
      context.signal,
    );
    const json = await readJsonResponse(response, context.limits, providerName);
    return parseGeminiResponse(json, providerName, context.limits.maxOutputImages);
  },
};

export function parseGeminiResponse(
  json: unknown,
  providerName = "Image provider",
  maxImages = 8,
): RawImageResult[] {
  const candidates = record(json)?.candidates;
  const output: RawImageResult[] = [];
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = record(record(candidate)?.content)?.parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const value = record(part);
        const inline = record(value?.inlineData) ?? record(value?.inline_data);
        const data = stringValue(inline?.data);
        const mimeType =
          stringValue(inline?.mimeType) ?? stringValue(inline?.mime_type) ?? "image/png";
        if (data) output.push({ data: { kind: "base64", bytes: data, mimeType } });
        if (output.length >= maxImages) return output;
      }
    }
  }
  return requireImages(output, providerName);
}

function readOverrides(value: JsonObject | undefined): GeminiOverrides {
  if (!value) return {};
  const output: GeminiOverrides = {};
  if (typeof value.pathTemplate === "string") output.pathTemplate = value.pathTemplate;
  if (typeof value.apiKeyHeader === "string") output.apiKeyHeader = value.apiKeyHeader;
  if (
    Array.isArray(value.responseModalities) &&
    value.responseModalities.every((item) => typeof item === "string")
  ) {
    output.responseModalities = value.responseModalities as string[];
  }
  if (
    value.generationConfig &&
    typeof value.generationConfig === "object" &&
    !Array.isArray(value.generationConfig)
  ) {
    output.generationConfig = value.generationConfig as JsonObject;
  }
  return output;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
