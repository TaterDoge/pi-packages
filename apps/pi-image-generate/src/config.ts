import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type {
  ConfigIssue,
  ConfigLoadResult,
  CredentialReference,
  GenericJsonProtocolConfig,
  HeaderReference,
  ImageGenerateLimits,
  ImageGenerateSettings,
  JsonObject,
  JsonValue,
  ModelCapabilities,
  ModelConfig,
  ProviderConfig,
  RequestTemplate,
} from "./types.ts";
import { BUILT_IN_PROTOCOLS } from "./types.ts";

export const SETTINGS_VERSION = 1;
export const EXT_NAME = "pi-image-generate";

export const DEFAULT_LIMITS: ImageGenerateLimits = {
  requestTimeoutMs: 300_000,
  pollIntervalMs: 2_000,
  maxPollAttempts: 150,
  maxResponseBytes: 10 * 1024 * 1024,
  maxImageBytes: 50 * 1024 * 1024,
  maxInputImages: 8,
  maxOutputImages: 8,
};

export function getDefaultImageGenerateSettings(): ImageGenerateSettings {
  return {
    version: SETTINGS_VERSION,
    outputDir: ".pi/images",
    limits: { ...DEFAULT_LIMITS },
    providers: {},
    protocols: {},
    models: {},
  };
}

export function getConfigPath(agentDir = getAgentDir()): string {
  return path.join(agentDir, "extensions", EXT_NAME, "config.json");
}

export async function loadImageGenerateSettings(agentDir?: string): Promise<ConfigLoadResult> {
  const configPath = getConfigPath(agentDir);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true, settings: getDefaultImageGenerateSettings(), path: configPath };
    }
    return {
      ok: false,
      settings: getDefaultImageGenerateSettings(),
      path: configPath,
      error: "Config file could not be read.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      settings: getDefaultImageGenerateSettings(),
      path: configPath,
      error: "Config file contains invalid JSON.",
    };
  }

  const validated = validateImageGenerateSettings(parsed);
  if (!validated.ok) {
    return {
      ok: false,
      settings: getDefaultImageGenerateSettings(),
      path: configPath,
      error: formatConfigIssues(validated.issues),
    };
  }
  return { ok: true, settings: validated.settings, path: configPath };
}

export async function writeImageGenerateSettings(
  settings: ImageGenerateSettings,
  agentDir?: string,
): Promise<void> {
  const validated = validateImageGenerateSettings(settings);
  if (!validated.ok) throw new Error(formatConfigIssues(validated.issues));
  const configPath = getConfigPath(agentDir);
  await mkdir(path.dirname(configPath), { recursive: true });
  const tmp = path.join(
    path.dirname(configPath),
    `.config.pi-image-generate.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(tmp, `${JSON.stringify(validated.settings, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(tmp, configPath);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

export function validateImageGenerateSettings(
  raw: unknown,
): { ok: true; settings: ImageGenerateSettings } | { ok: false; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = [];
  if (!isRecord(raw))
    return { ok: false, issues: [issue("pi-image-generate", "must be an object")] };
  rejectUnknown(
    raw,
    ["version", "defaultModel", "outputDir", "limits", "providers", "protocols", "models"],
    "pi-image-generate",
    issues,
  );
  if (raw.version !== SETTINGS_VERSION) issuePush(issues, "version", "must be 1");
  const outputDir = nonEmptyString(raw.outputDir, "outputDir", issues) ?? ".pi/images";
  const limits = parseLimits(raw.limits, issues);
  const providers = parseMap(raw.providers, "providers", issues, parseProvider);
  const protocols = parseMap(raw.protocols, "protocols", issues, parseProtocol);
  const models = parseMap(raw.models, "models", issues, parseModel);
  const defaultModel = optionalNonEmptyString(raw.defaultModel, "defaultModel", issues);

  for (const [id, provider] of Object.entries(providers)) {
    if (
      !BUILT_IN_PROTOCOLS.includes(provider.protocol as (typeof BUILT_IN_PROTOCOLS)[number]) &&
      !protocols[provider.protocol]
    ) {
      issuePush(
        issues,
        `providers.${id}.protocol`,
        `references unknown protocol "${provider.protocol}"`,
      );
    }
  }
  for (const [id, model] of Object.entries(models)) {
    if (!providers[model.provider]) {
      issuePush(issues, `models.${id}.provider`, `references unknown provider "${model.provider}"`);
    }
  }
  if (defaultModel && !models[defaultModel]) {
    issuePush(issues, "defaultModel", `references unknown model "${defaultModel}"`);
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    settings: {
      version: SETTINGS_VERSION,
      ...(defaultModel ? { defaultModel } : {}),
      outputDir,
      limits,
      providers,
      protocols,
      models,
    },
  };
}

function parseProvider(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): ProviderConfig | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(raw, ["name", "baseUrl", "protocol", "credential", "headers"], at, issues);
  const name = optionalNonEmptyString(raw.name, `${at}.name`, issues);
  const baseUrl = nonEmptyString(raw.baseUrl, `${at}.baseUrl`, issues);
  const protocol = nonEmptyString(raw.protocol, `${at}.protocol`, issues);
  validateHttpUrl(baseUrl, `${at}.baseUrl`, issues);
  const credential =
    raw.credential === undefined
      ? undefined
      : parseCredential(raw.credential, `${at}.credential`, issues);
  const headers =
    raw.headers === undefined ? undefined : parseHeaders(raw.headers, `${at}.headers`, issues);
  if (!baseUrl || !protocol) return undefined;
  return {
    ...(name ? { name } : {}),
    baseUrl,
    protocol,
    ...(credential ? { credential } : {}),
    ...(headers ? { headers } : {}),
  };
}

function parseCredential(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): CredentialReference | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(raw, ["source", "value"], at, issues);
  if (raw.source === "pi-auth") {
    if (raw.value !== undefined) issuePush(issues, `${at}.value`, "is not allowed for pi-auth");
    return { source: "pi-auth" };
  }
  if (raw.source !== "env" && raw.source !== "literal") {
    return issueValue(issues, `${at}.source`, "must be env, literal, or pi-auth");
  }
  const value = nonEmptyString(raw.value, `${at}.value`, issues);
  if (!value) return undefined;
  if (raw.source === "env" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    issuePush(issues, `${at}.value`, "must be an environment variable name");
  }
  return { source: raw.source, value };
}

function parseHeaders(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): HeaderReference[] | undefined {
  if (!Array.isArray(raw)) return issueValue(issues, at, "must be an array");
  const out: HeaderReference[] = [];
  const names = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const itemAt = `${at}.${index}`;
    if (!isRecord(item)) {
      issuePush(issues, itemAt, "must be an object");
      continue;
    }
    rejectUnknown(item, ["name", "value"], itemAt, issues);
    const name = nonEmptyString(item.name, `${itemAt}.name`, issues);
    const value = parseCredential(item.value, `${itemAt}.value`, issues);
    if (!name || !value) continue;
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      issuePush(issues, `${itemAt}.name`, "is not a valid HTTP header name");
      continue;
    }
    const lower = name.toLowerCase();
    if (names.has(lower)) {
      issuePush(issues, `${itemAt}.name`, "is duplicated");
      continue;
    }
    names.add(lower);
    out.push({ name, value });
  }
  return out;
}

function parseModel(raw: unknown, at: string, issues: ConfigIssue[]): ModelConfig | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(
    raw,
    ["provider", "id", "name", "capabilities", "defaults", "parameterMap", "protocolOverrides"],
    at,
    issues,
  );
  const provider = nonEmptyString(raw.provider, `${at}.provider`, issues);
  const id = nonEmptyString(raw.id, `${at}.id`, issues);
  const name = optionalNonEmptyString(raw.name, `${at}.name`, issues);
  const capabilities = parseCapabilities(raw.capabilities, `${at}.capabilities`, issues);
  const defaults = optionalJsonObject(raw.defaults, `${at}.defaults`, issues);
  const parameterMap = parseParameterMap(raw.parameterMap, `${at}.parameterMap`, issues);
  const protocolOverrides = optionalJsonObject(
    raw.protocolOverrides,
    `${at}.protocolOverrides`,
    issues,
  );
  if (!provider || !id || !capabilities) return undefined;
  return {
    provider,
    id,
    ...(name ? { name } : {}),
    capabilities,
    ...(defaults ? { defaults } : {}),
    ...(parameterMap ? { parameterMap } : {}),
    ...(protocolOverrides ? { protocolOverrides } : {}),
  };
}

function parseCapabilities(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): ModelCapabilities | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(raw, ["imageInput", "n", "size", "qualityValues"], at, issues);
  const imageInput = raw.imageInput;
  if (imageInput !== "none" && imageInput !== "single" && imageInput !== "multiple") {
    issuePush(issues, `${at}.imageInput`, "must be none, single, or multiple");
  }
  if (typeof raw.n !== "boolean") issuePush(issues, `${at}.n`, "must be boolean");
  if (typeof raw.size !== "boolean") issuePush(issues, `${at}.size`, "must be boolean");
  const qualityValues = stringArray(raw.qualityValues, `${at}.qualityValues`, issues);
  if (
    !qualityValues ||
    (imageInput !== "none" && imageInput !== "single" && imageInput !== "multiple") ||
    typeof raw.n !== "boolean" ||
    typeof raw.size !== "boolean"
  )
    return undefined;
  return { imageInput, n: raw.n, size: raw.size, qualityValues };
}

function parseParameterMap(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): ModelConfig["parameterMap"] | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  const keys = ["prompt", "image", "n", "size", "quality"] as const;
  rejectUnknown(raw, keys, at, issues);
  const out: NonNullable<ModelConfig["parameterMap"]> = {};
  for (const key of keys) {
    const value = optionalNonEmptyString(raw[key], `${at}.${key}`, issues);
    if (value) out[key] = value;
  }
  return out;
}

function parseProtocol(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): GenericJsonProtocolConfig | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(raw, ["type", "request", "response", "poll"], at, issues);
  if (raw.type !== "generic-json") issuePush(issues, `${at}.type`, "must be generic-json");
  const request = parseRequestTemplate(raw.request, `${at}.request`, issues);
  if (!isRecord(raw.response)) issuePush(issues, `${at}.response`, "must be an object");
  const response = isRecord(raw.response) ? raw.response : {};
  rejectUnknown(
    response,
    ["imagePaths", "mimeTypePath", "revisedPromptPath"],
    `${at}.response`,
    issues,
  );
  const imagePaths = stringArray(response.imagePaths, `${at}.response.imagePaths`, issues);
  if (imagePaths?.length === 0) issuePush(issues, `${at}.response.imagePaths`, "must not be empty");
  const mimeTypePath = optionalNonEmptyString(
    response.mimeTypePath,
    `${at}.response.mimeTypePath`,
    issues,
  );
  const revisedPromptPath = optionalNonEmptyString(
    response.revisedPromptPath,
    `${at}.response.revisedPromptPath`,
    issues,
  );
  const poll = raw.poll === undefined ? undefined : parsePoll(raw.poll, `${at}.poll`, issues);
  if (raw.type !== "generic-json" || !request || !imagePaths?.length) return undefined;
  return {
    type: "generic-json",
    request,
    response: {
      imagePaths,
      ...(mimeTypePath ? { mimeTypePath } : {}),
      ...(revisedPromptPath ? { revisedPromptPath } : {}),
    },
    ...(poll ? { poll } : {}),
  };
}

function parsePoll(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): GenericJsonProtocolConfig["poll"] | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(
    raw,
    [
      "request",
      "taskIdPath",
      "statusPath",
      "successStatuses",
      "failureStatuses",
      "resultRequest",
      "errorPath",
      "intervalMs",
      "maxAttempts",
    ],
    at,
    issues,
  );
  const request = parseRequestTemplate(raw.request, `${at}.request`, issues);
  const taskIdPath = nonEmptyString(raw.taskIdPath, `${at}.taskIdPath`, issues);
  const statusPath = nonEmptyString(raw.statusPath, `${at}.statusPath`, issues);
  const successStatuses = stringArray(raw.successStatuses, `${at}.successStatuses`, issues);
  const failureStatuses = stringArray(raw.failureStatuses, `${at}.failureStatuses`, issues);
  const resultRequest =
    raw.resultRequest === undefined
      ? undefined
      : parseRequestTemplate(raw.resultRequest, `${at}.resultRequest`, issues);
  const errorPath = optionalNonEmptyString(raw.errorPath, `${at}.errorPath`, issues);
  const intervalMs = optionalInteger(raw.intervalMs, `${at}.intervalMs`, issues, 100, 60_000);
  const maxAttempts = optionalInteger(raw.maxAttempts, `${at}.maxAttempts`, issues, 1, 10_000);
  if (!request || !taskIdPath || !statusPath || !successStatuses || !failureStatuses)
    return undefined;
  return {
    request,
    taskIdPath,
    statusPath,
    successStatuses,
    failureStatuses,
    ...(resultRequest ? { resultRequest } : {}),
    ...(errorPath ? { errorPath } : {}),
    ...(intervalMs ? { intervalMs } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
  };
}

function parseRequestTemplate(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): RequestTemplate | undefined {
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  rejectUnknown(raw, ["method", "url", "headers", "body"], at, issues);
  const method = raw.method === undefined ? "POST" : raw.method;
  if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "GET")
    issuePush(issues, `${at}.method`, "must be GET, POST, PUT, or PATCH");
  const url = nonEmptyString(raw.url, `${at}.url`, issues);
  let headers: Record<string, string> | undefined;
  if (raw.headers !== undefined) {
    if (!isRecord(raw.headers)) issuePush(issues, `${at}.headers`, "must be an object");
    else {
      headers = {};
      for (const [name, value] of Object.entries(raw.headers)) {
        if (typeof value !== "string")
          issuePush(issues, `${at}.headers.${name}`, "must be a string");
        else headers[name] = value;
      }
    }
  }
  const body = raw.body === undefined ? undefined : parseJsonValue(raw.body, `${at}.body`, issues);
  if (!url || (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "GET"))
    return undefined;
  return { method, url, ...(headers ? { headers } : {}), ...(body !== undefined ? { body } : {}) };
}

function parseLimits(raw: unknown, issues: ConfigIssue[]): ImageGenerateLimits {
  if (raw === undefined) return { ...DEFAULT_LIMITS };
  if (!isRecord(raw)) {
    issuePush(issues, "limits", "must be an object");
    return { ...DEFAULT_LIMITS };
  }
  const keys = Object.keys(DEFAULT_LIMITS) as (keyof ImageGenerateLimits)[];
  rejectUnknown(raw, keys, "limits", issues);
  const result = { ...DEFAULT_LIMITS };
  for (const key of keys) {
    if (raw[key] === undefined) continue;
    const max = key.startsWith("max") && key.endsWith("Images") ? 64 : 2_147_483_647;
    const value = optionalInteger(raw[key], `limits.${key}`, issues, 1, max);
    if (value) result[key] = value;
  }
  return result;
}

function parseMap<T>(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
  parser: (value: unknown, at: string, issues: ConfigIssue[]) => T | undefined,
): Record<string, T> {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    issuePush(issues, at, "must be an object");
    return {};
  }
  const out: Record<string, T> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(id)) {
      issuePush(issues, `${at}.${id}`, "has an invalid id");
      continue;
    }
    const parsed = parser(value, `${at}.${id}`, issues);
    if (parsed) out[id] = parsed;
  }
  return out;
}

function optionalJsonObject(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): JsonObject | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) return issueValue(issues, at, "must be an object");
  return parseJsonValue(raw, at, issues) as JsonObject | undefined;
}

function parseJsonValue(raw: unknown, at: string, issues: ConfigIssue[]): JsonValue | undefined {
  if (raw === null || typeof raw === "string" || typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return issueValue(issues, at, "must be finite");
    return raw;
  }
  if (Array.isArray(raw)) {
    const out: JsonValue[] = [];
    for (const [index, item] of raw.entries()) {
      const parsed = parseJsonValue(item, `${at}.${index}`, issues);
      if (parsed !== undefined) out.push(parsed);
    }
    return out;
  }
  if (isRecord(raw)) {
    const out: JsonObject = {};
    for (const [key, value] of Object.entries(raw)) {
      const parsed = parseJsonValue(value, `${at}.${key}`, issues);
      if (parsed !== undefined) out[key] = parsed;
    }
    return out;
  }
  return issueValue(issues, at, "must contain JSON values only");
}

function stringArray(raw: unknown, at: string, issues: ConfigIssue[]): string[] | undefined {
  if (!Array.isArray(raw)) return issueValue(issues, at, "must be an array of strings");
  const out: string[] = [];
  for (const [index, item] of raw.entries()) {
    const value = nonEmptyString(item, `${at}.${index}`, issues);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function validateHttpUrl(value: string | undefined, at: string, issues: ConfigIssue[]): void {
  if (!value) return;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password)
      throw new Error();
  } catch {
    issuePush(issues, at, "must be an http(s) URL without userinfo");
  }
}

function nonEmptyString(raw: unknown, at: string, issues: ConfigIssue[]): string | undefined {
  if (typeof raw !== "string" || !raw.trim())
    return issueValue(issues, at, "must be a non-empty string");
  return raw.trim();
}

function optionalNonEmptyString(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
): string | undefined {
  return raw === undefined ? undefined : nonEmptyString(raw, at, issues);
}

function optionalInteger(
  raw: unknown,
  at: string,
  issues: ConfigIssue[],
  min: number,
  max: number,
): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isInteger(raw) || (raw as number) < min || (raw as number) > max)
    return issueValue(issues, at, `must be an integer from ${min} to ${max}`);
  return raw as number;
}

function rejectUnknown(
  raw: Record<string, unknown>,
  allowed: readonly string[],
  at: string,
  issues: ConfigIssue[],
): void {
  for (const key of Object.keys(raw))
    if (!allowed.includes(key)) issuePush(issues, `${at}.${key}`, "is not supported");
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === "object" && !Array.isArray(raw);
}

function issue(pathValue: string, message: string): ConfigIssue {
  return { path: pathValue, message };
}

function issuePush(issues: ConfigIssue[], pathValue: string, message: string): void {
  issues.push(issue(pathValue, message));
}

function issueValue<T>(issues: ConfigIssue[], pathValue: string, message: string): T | undefined {
  issuePush(issues, pathValue, message);
  return undefined;
}

function formatConfigIssues(issues: ConfigIssue[]): string {
  return `Invalid pi-image-generate settings: ${issues
    .slice(0, 8)
    .map((entry) => `${entry.path} ${entry.message}`)
    .join("; ")}${issues.length > 8 ? "; …" : ""}`;
}
