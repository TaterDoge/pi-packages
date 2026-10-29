import type { PiCredentialResolver } from "./credentials.ts";
import { resolveCredential, resolveHeaderReferences } from "./credentials.ts";
import { fetchWithTimeout, joinUrl, readJsonResponse } from "./protocols/http.ts";
import type { ImageGenerateSettings, ProviderConfig } from "./types.ts";

export type RemoteModel = {
  id: string;
  name?: string;
  description?: string;
};

/** Lists the models a provider exposes. Shared by the settings page and the extension. */
export async function discoverProviderModels(options: {
  providerId: string;
  provider: ProviderConfig;
  settings: ImageGenerateSettings;
  modelRegistry: PiCredentialResolver;
  fetchImpl?: typeof fetch;
}): Promise<RemoteModel[]> {
  const { providerId, provider, settings, modelRegistry, fetchImpl = fetch } = options;
  const [apiKey, headers] = await Promise.all([
    resolveCredential(provider.credential, providerId, modelRegistry),
    resolveHeaderReferences(provider.headers, providerId, modelRegistry),
  ]);
  const requestHeaders: Record<string, string> = { ...headers, accept: "application/json" };
  if (apiKey) {
    if (provider.protocol === "gemini-generate-content") requestHeaders["x-goog-api-key"] = apiKey;
    else requestHeaders.authorization = `Bearer ${apiKey}`;
  }
  const response = await fetchWithTimeout(
    fetchImpl,
    joinUrl(provider.baseUrl, "models"),
    { method: "GET", headers: requestHeaders },
    settings.limits.requestTimeoutMs,
  );
  const payload = await readJsonResponse(response, settings.limits, provider.name ?? providerId);
  return parseRemoteModels(payload);
}

export function parseRemoteModels(payload: unknown): RemoteModel[] {
  const root = record(payload);
  let entries: unknown[] = [];
  if (Array.isArray(root?.data)) entries = root.data;
  else if (Array.isArray(root?.models)) entries = root.models;
  const output = new Map<string, RemoteModel>();
  for (const entry of entries) {
    const value = record(entry);
    const explicitId = stringValue(value?.id);
    const rawId = explicitId ?? stringValue(value?.name);
    if (!rawId) continue;
    const id = rawId.replace(/^models\//, "");
    const name =
      stringValue(value?.displayName) ??
      stringValue(value?.display_name) ??
      (explicitId ? stringValue(value?.name) : undefined);
    output.set(id, {
      id,
      ...(name ? { name } : {}),
      ...(stringValue(value?.description) ? { description: stringValue(value?.description) } : {}),
    });
  }
  return [...output.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
