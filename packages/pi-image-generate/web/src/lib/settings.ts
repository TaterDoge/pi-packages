import type {
  GenericJsonProtocolConfig,
  ImageGenerateSettings,
  ModelConfig,
  ProviderConfig,
} from "../types.js";

export const BUILT_INS = ["openai-images", "gemini-generate-content"];
export const EMPTY_PROVIDER: ProviderConfig = { baseUrl: "https://", protocol: "openai-images" };
export const EMPTY_MODEL: ModelConfig = {
  provider: "",
  id: "",
  capabilities: { imageInput: "none", n: false, qualityValues: [], size: false },
};
export const EMPTY_PROTOCOL: GenericJsonProtocolConfig = {
  type: "generic-json",
  request: { url: "generate" },
  response: { imagePaths: ["data.*.url"] },
};
export const IMAGE_INPUTS = ["none", "single", "multiple"] as const;
export const LIMIT_LABELS: Record<string, string> = {
  maxImageBytes: "Max image bytes",
  maxInputImages: "Max input images",
  maxOutputImages: "Max output images",
  maxPollAttempts: "Max poll attempts",
  maxResponseBytes: "Max response bytes",
  pollIntervalMs: "Poll interval (ms)",
  requestTimeoutMs: "Request timeout (ms)",
};
export const CREDENTIAL_SOURCES = ["none", "env", "literal", "pi-auth"] as const;

export type EditorProps = {
  settings: ImageGenerateSettings;
  update: (settings: ImageGenerateSettings) => void;
};

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function patchProvider(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ProviderConfig>,
) {
  const current = settings.providers[id];
  const next = { ...current, ...patch } as ProviderConfig;
  // Kobalte re-fires onChange with the current value on every re-render; writing an
  // identical settings object back would re-render forever.
  if (sameJson(current, next)) return;
  update({ ...settings, providers: { ...settings.providers, [id]: next } });
}

export function patchModel(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ModelConfig>,
) {
  const current = settings.models[id];
  const next = { ...current, ...patch } as ModelConfig;
  if (sameJson(current, next)) return;
  update({ ...settings, models: { ...settings.models, [id]: next } });
}

export function patchCapabilities(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ModelConfig["capabilities"]>,
) {
  const model = settings.models[id];
  if (model)
    patchModel(settings, update, id, { capabilities: { ...model.capabilities, ...patch } });
}

export function patchProtocol(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<GenericJsonProtocolConfig>,
) {
  const current = settings.protocols[id];
  const next = { ...current, ...patch } as GenericJsonProtocolConfig;
  if (sameJson(current, next)) return;
  update({ ...settings, protocols: { ...settings.protocols, [id]: next } });
}

export function omit<T>(record: Record<string, T>, id: string) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

export function omitBy<T>(record: Record<string, T>, drop: (value: T) => boolean) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => !drop(value)));
}

export function rename<T>(record: Record<string, T>, oldId: string, newId: string, value: T) {
  if (!newId || newId === oldId || record[newId]) return record;
  return Object.fromEntries(
    Object.entries(record).map(([id, item]) => (id === oldId ? [newId, value] : [id, item])),
  );
}

export function uniqueInsert<T>(record: Record<string, T>, base: string, value: T) {
  let id = base;
  let suffix = 2;
  while (record[id]) id = `${base}-${suffix++}`;
  return { ...record, [id]: structuredClone(value) };
}

export function optional(value: string) {
  return value.trim() || undefined;
}

export function splitLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
