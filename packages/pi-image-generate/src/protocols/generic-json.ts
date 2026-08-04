import { ImageGenerateError } from "../errors.ts";
import type {
  GenericJsonProtocolConfig,
  ImageProtocol,
  ProtocolContext,
  RawImageResult,
  RequestTemplate,
} from "../types.ts";
import { fetchWithTimeout, joinUrl, readJsonResponse } from "./http.ts";
import { classifyImageReference, requireImages } from "./output.ts";
import {
  extractFirst,
  extractPath,
  renderTemplate,
  renderTemplateString,
  type TemplateVariables,
} from "./template.ts";

export function createGenericJsonProtocol(config: GenericJsonProtocolConfig): ImageProtocol {
  return {
    async generate(context) {
      const variables = buildVariables(context);
      context.onPhase?.(
        "requesting",
        `Submitting image request to ${context.provider.name ?? context.providerId}`,
      );
      const submitJson = await executeRequest(config.request, variables, context);
      let resultJson = submitJson;
      if (config.poll) {
        const taskId = scalar(extractFirst(submitJson, config.poll.taskIdPath));
        if (!taskId) {
          throw new ImageGenerateError(
            "The provider submit response did not contain the configured task id.",
            "generic-task-id-missing",
          );
        }
        variables.taskId = taskId;
        resultJson = await pollForResult(config.poll, variables, context);
      }
      return parseGenericImages(resultJson, config, context);
    },
  };
}

async function pollForResult(
  poll: NonNullable<GenericJsonProtocolConfig["poll"]>,
  variables: TemplateVariables,
  context: ProtocolContext,
): Promise<unknown> {
  const interval = poll.intervalMs ?? context.limits.pollIntervalMs;
  const maxAttempts = Math.min(
    poll.maxAttempts ?? context.limits.maxPollAttempts,
    context.limits.maxPollAttempts,
  );
  const success = new Set(poll.successStatuses.map(normalizeStatus));
  const failure = new Set(poll.failureStatuses.map(normalizeStatus));
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (context.signal?.aborted) {
      throw new ImageGenerateError("Image generation was cancelled.", "generic-poll-cancelled");
    }
    context.onPhase?.("polling", `Waiting for image result (${attempt}/${maxAttempts})`);
    const json = await executeRequest(poll.request, variables, context);
    const rawStatus = scalar(extractFirst(json, poll.statusPath));
    if (!rawStatus) {
      throw new ImageGenerateError(
        "The provider poll response did not contain the configured status.",
        "generic-status-missing",
      );
    }
    const status = normalizeStatus(rawStatus);
    if (success.has(status)) {
      return poll.resultRequest ? executeRequest(poll.resultRequest, variables, context) : json;
    }
    if (failure.has(status)) {
      throw new ImageGenerateError(
        "The image provider reported that the generation task failed.",
        "generic-provider-task-failed",
      );
    }
    if (attempt < maxAttempts) await delay(interval, context.signal);
  }
  throw new ImageGenerateError(
    "The image provider did not finish before the configured polling limit.",
    "generic-poll-attempts-exceeded",
  );
}

async function executeRequest(
  request: RequestTemplate,
  variables: TemplateVariables,
  context: ProtocolContext,
): Promise<unknown> {
  const renderedUrl = renderTemplateString(request.url, variables);
  if (typeof renderedUrl !== "string") {
    throw new ImageGenerateError(
      "A request URL template must render to a string.",
      "generic-url-type-invalid",
    );
  }
  const headers: Record<string, string> = {
    ...context.headers,
    ...(context.apiKey ? { authorization: `Bearer ${context.apiKey}` } : {}),
  };
  for (const [name, template] of Object.entries(request.headers ?? {})) {
    const rendered = renderTemplateString(template, variables);
    if (typeof rendered !== "string") {
      throw new ImageGenerateError(
        "A request header template must render to a string.",
        "generic-header-type-invalid",
      );
    }
    headers[name] = rendered;
  }
  let body: string | undefined;
  if (request.body !== undefined && request.method !== "GET") {
    headers["content-type"] ??= "application/json";
    body = JSON.stringify(renderTemplate(request.body, variables));
  }
  const response = await fetchWithTimeout(
    context.fetchImpl,
    joinUrl(context.provider.baseUrl, renderedUrl),
    { method: request.method ?? "POST", headers, ...(body ? { body } : {}) },
    context.limits.requestTimeoutMs,
    context.signal,
  );
  return readJsonResponse(response, context.limits, context.provider.name ?? context.providerId);
}

function parseGenericImages(
  json: unknown,
  config: GenericJsonProtocolConfig,
  context: ProtocolContext,
): RawImageResult[] {
  const mimeType = config.response.mimeTypePath
    ? scalar(extractFirst(json, config.response.mimeTypePath))
    : undefined;
  const revisedPrompt = config.response.revisedPromptPath
    ? scalar(extractFirst(json, config.response.revisedPromptPath))
    : undefined;
  const output: RawImageResult[] = [];
  for (const path of config.response.imagePaths) {
    for (const value of extractPath(json, path)) {
      const classified = classifyImageReference(value, mimeType);
      if (!classified) continue;
      output.push({ data: classified, ...(revisedPrompt ? { revisedPrompt } : {}) });
      if (output.length >= context.limits.maxOutputImages) return output;
    }
  }
  return requireImages(output, context.provider.name ?? context.providerId);
}

function buildVariables(context: ProtocolContext): TemplateVariables {
  const dataUris = context.inputs.map(
    (input) => `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`,
  );
  const imageUrls = context.inputs
    .map((input) => input.sourceUrl)
    .filter((value): value is string => Boolean(value));
  return {
    baseUrl: context.provider.baseUrl,
    model: context.model.id,
    prompt: context.params.prompt,
    n: context.params.n ?? 1,
    size: context.params.size,
    quality: context.params.quality,
    imageDataUris: dataUris,
    imageUrls,
  };
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      new ImageGenerateError("Image generation was cancelled.", "generic-poll-cancelled"),
    );
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new ImageGenerateError("Image generation was cancelled.", "generic-poll-cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
