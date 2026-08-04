export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export const BUILT_IN_PROTOCOLS = ["openai-images", "gemini-generate-content"] as const;
export type BuiltInProtocolId = (typeof BUILT_IN_PROTOCOLS)[number];
export type ImageInputCapability = "none" | "single" | "multiple";

export type CredentialReference =
  | { source: "env"; value: string }
  | { source: "literal"; value: string }
  | { source: "pi-auth" };

export type HeaderReference = {
  name: string;
  value: CredentialReference;
};

export type ProviderConfig = {
  name?: string;
  baseUrl: string;
  protocol: string;
  credential?: CredentialReference;
  headers?: HeaderReference[];
};

export type ModelCapabilities = {
  imageInput: ImageInputCapability;
  n: boolean;
  size: boolean;
  qualityValues: string[];
};

export type ModelConfig = {
  provider: string;
  id: string;
  name?: string;
  capabilities: ModelCapabilities;
  defaults?: JsonObject;
  parameterMap?: Partial<Record<"prompt" | "image" | "n" | "size" | "quality", string>>;
  protocolOverrides?: JsonObject;
};

export type RequestTemplate = {
  method?: "POST" | "PUT" | "PATCH" | "GET";
  url: string;
  headers?: Record<string, string>;
  body?: JsonValue;
};

export type GenericJsonResponseConfig = {
  imagePaths: string[];
  mimeTypePath?: string;
  revisedPromptPath?: string;
};

export type GenericJsonPollConfig = {
  request: RequestTemplate;
  taskIdPath: string;
  statusPath: string;
  successStatuses: string[];
  failureStatuses: string[];
  resultRequest?: RequestTemplate;
  errorPath?: string;
  intervalMs?: number;
  maxAttempts?: number;
};

export type GenericJsonProtocolConfig = {
  type: "generic-json";
  request: RequestTemplate;
  response: GenericJsonResponseConfig;
  poll?: GenericJsonPollConfig;
};

export type ImageGenerateLimits = {
  requestTimeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
  maxResponseBytes: number;
  maxImageBytes: number;
  maxInputImages: number;
  maxOutputImages: number;
};

export type ImageGenerateSettings = {
  version: 1;
  defaultModel?: string;
  outputDir: string;
  limits: ImageGenerateLimits;
  providers: Record<string, ProviderConfig>;
  protocols: Record<string, GenericJsonProtocolConfig>;
  models: Record<string, ModelConfig>;
};

export type ConfigIssue = {
  path: string;
  message: string;
};

export type ConfigLoadResult =
  | { ok: true; settings: ImageGenerateSettings; path: string }
  | { ok: false; settings: ImageGenerateSettings; path: string; error: string };

export type GenerateImageParams = {
  prompt: string;
  image?: string[];
  n?: number;
  size?: string;
  quality?: string;
  filename?: string;
  outputDir?: string;
};

export type ResolvedImageInput = {
  bytes: Uint8Array;
  mimeType: string;
  sourceUrl?: string;
};

export type RawImageResult = {
  data:
    | { kind: "base64"; bytes: string; mimeType?: string }
    | { kind: "url"; url: string }
    | { kind: "bytes"; bytes: Uint8Array; mimeType: string };
  revisedPrompt?: string;
};

export type ProtocolPhase = "requesting" | "polling";

export type ProtocolContext = {
  providerId: string;
  provider: ProviderConfig;
  model: ModelConfig;
  params: GenerateImageParams;
  inputs: ResolvedImageInput[];
  apiKey?: string;
  headers: Record<string, string>;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  limits: ImageGenerateLimits;
  onPhase?: (phase: ProtocolPhase, message: string) => void;
};

export interface ImageProtocol {
  generate(context: ProtocolContext): Promise<RawImageResult[]>;
}

export type GenerationSource = "tool" | "command";
export type GenerationPhase =
  | "queued"
  | "preparing"
  | "requesting"
  | "polling"
  | "downloading"
  | "saving"
  | "succeeded"
  | "failed"
  | "cancelled";

export type GenerationTask = {
  id: string;
  source: GenerationSource;
  provider: string;
  model: string;
  remoteModel: string;
  phase: GenerationPhase;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  imageCount?: number;
  outputPaths?: string[];
  error?: { category: string; message: string };
};

export type GeneratedImage = {
  path: string;
  mimeType: string;
  data: string;
  revisedPrompt?: string;
};

export type ImageGenerateResult = {
  provider: string;
  model: string;
  remoteModel: string;
  taskId: string;
  images: GeneratedImage[];
};
