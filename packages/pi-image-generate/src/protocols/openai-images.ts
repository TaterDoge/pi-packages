import { ImageGenerateError } from "../errors.ts";
import type { ImageProtocol, JsonObject, ProtocolContext, RawImageResult } from "../types.ts";
import { fetchWithTimeout, joinUrl, readJsonResponse } from "./http.ts";
import { classifyImageReference, requireImages } from "./output.ts";

export type OpenAiImagesOverrides = {
  generationPath?: string;
  editPath?: string;
  editMode?: "multipart" | "json";
  referenceField?: string;
  responseDataPath?: string;
  urlField?: string;
  base64Field?: string;
  mimeTypeField?: string;
  revisedPromptField?: string;
  imageFieldMode?: "single" | "array" | "objects";
  imageObjectField?: string;
};

export const openAiImagesProtocol: ImageProtocol = {
  async generate(context) {
    const overrides = readOverrides(context.model.protocolOverrides);
    const providerName = context.provider.name ?? context.providerId;
    if (context.inputs.length > 0 && overrides.editMode === "multipart") {
      return multipartEdit(context, overrides, providerName);
    }
    return jsonGeneration(context, overrides, providerName);
  },
};

async function jsonGeneration(
  context: ProtocolContext,
  overrides: OpenAiImagesOverrides,
  providerName: string,
): Promise<RawImageResult[]> {
  const endpoint =
    context.inputs.length > 0 && overrides.editPath
      ? overrides.editPath
      : (overrides.generationPath ?? "images/generations");
  const body: Record<string, unknown> = {
    model: context.model.id,
    prompt: context.params.prompt,
    n: context.params.n ?? 1,
    ...(context.model.defaults ?? {}),
  };
  if (context.params.size) body[context.model.parameterMap?.size ?? "size"] = context.params.size;
  if (context.params.quality)
    body[context.model.parameterMap?.quality ?? "quality"] = context.params.quality;
  if (context.inputs.length > 0) addJsonReferences(body, context, overrides);
  context.onPhase?.("requesting", `Requesting image from ${providerName}`);
  const response = await fetchWithTimeout(
    context.fetchImpl,
    joinUrl(context.provider.baseUrl, endpoint),
    {
      method: "POST",
      headers: requestHeaders(context, true),
      body: JSON.stringify(body),
    },
    context.limits.requestTimeoutMs,
    context.signal,
  );
  const json = await readJsonResponse(response, context.limits, providerName);
  return parseOpenAiImagesResponse(json, overrides, providerName, context.limits.maxOutputImages);
}

async function multipartEdit(
  context: ProtocolContext,
  overrides: OpenAiImagesOverrides,
  providerName: string,
): Promise<RawImageResult[]> {
  const form = new FormData();
  form.append(context.model.parameterMap?.prompt ?? "prompt", context.params.prompt);
  form.append("model", context.model.id);
  form.append(context.model.parameterMap?.n ?? "n", String(context.params.n ?? 1));
  if (context.params.size)
    form.append(context.model.parameterMap?.size ?? "size", context.params.size);
  if (context.params.quality)
    form.append(context.model.parameterMap?.quality ?? "quality", context.params.quality);
  for (const [key, value] of Object.entries(context.model.defaults ?? {})) {
    if (value !== null && typeof value !== "object") form.append(key, String(value));
  }
  const field = overrides.referenceField ?? (context.inputs.length > 1 ? "image[]" : "image");
  for (const [index, input] of context.inputs.entries()) {
    const ext = input.mimeType.split("/")[1] ?? "png";
    const bytes = Buffer.from(input.bytes);
    form.append(
      field,
      new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
        type: input.mimeType,
      }),
      `image-${index}.${ext}`,
    );
  }
  context.onPhase?.("requesting", `Editing image with ${providerName}`);
  const response = await fetchWithTimeout(
    context.fetchImpl,
    joinUrl(context.provider.baseUrl, overrides.editPath ?? "images/edits"),
    { method: "POST", headers: requestHeaders(context, false), body: form },
    context.limits.requestTimeoutMs,
    context.signal,
  );
  const json = await readJsonResponse(response, context.limits, providerName);
  return parseOpenAiImagesResponse(json, overrides, providerName, context.limits.maxOutputImages);
}

function addJsonReferences(
  body: Record<string, unknown>,
  context: ProtocolContext,
  overrides: OpenAiImagesOverrides,
): void {
  const field = overrides.referenceField ?? context.model.parameterMap?.image ?? "image";
  const values = context.inputs.map(
    (input) => `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`,
  );
  if (overrides.imageFieldMode === "objects") {
    const nested = overrides.imageObjectField ?? "url";
    body[field] = values.map((value) => ({ [nested]: value }));
  } else if (overrides.imageFieldMode === "single") body[field] = values[0];
  else body[field] = values;
}

function requestHeaders(context: ProtocolContext, json: boolean): Record<string, string> {
  return {
    ...(context.apiKey ? { authorization: `Bearer ${context.apiKey}` } : {}),
    ...context.headers,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

export function parseOpenAiImagesResponse(
  json: unknown,
  overrides: OpenAiImagesOverrides = {},
  providerName = "Image provider",
  maxImages = 8,
): RawImageResult[] {
  const data = getPath(json, overrides.responseDataPath ?? "data");
  if (!Array.isArray(data)) {
    throw new ImageGenerateError(
      `${providerName} returned an unexpected image response shape.`,
      "provider-response-shape-invalid",
    );
  }
  const output: RawImageResult[] = [];
  for (const raw of data.slice(0, maxImages)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const mime = stringValue(entry[overrides.mimeTypeField ?? "media_type"]);
    const reference =
      entry[overrides.base64Field ?? "b64_json"] ?? entry[overrides.urlField ?? "url"];
    const classified = classifyImageReference(reference, mime);
    if (!classified) continue;
    const revisedPrompt = stringValue(entry[overrides.revisedPromptField ?? "revised_prompt"]);
    output.push({ data: classified, ...(revisedPrompt ? { revisedPrompt } : {}) });
  }
  return requireImages(output, providerName);
}

function readOverrides(value: JsonObject | undefined): OpenAiImagesOverrides {
  if (!value) return {};
  const allowed = [
    "generationPath",
    "editPath",
    "editMode",
    "referenceField",
    "responseDataPath",
    "urlField",
    "base64Field",
    "mimeTypeField",
    "revisedPromptField",
    "imageFieldMode",
    "imageObjectField",
  ];
  const out: Record<string, string> = {};
  for (const key of allowed) if (typeof value[key] === "string") out[key] = value[key] as string;
  return out as OpenAiImagesOverrides;
}

function getPath(root: unknown, path: string): unknown {
  let value = root;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
