export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type CredentialReference =
  | { source: "env"; value: string }
  | { source: "literal"; value: string }
  | { source: "pi-auth" };

export type ProviderConfig = {
  name?: string;
  baseUrl: string;
  protocol: string;
  credential?: CredentialReference;
  headers?: Array<{ name: string; value: CredentialReference }>;
};

export type ModelConfig = {
  provider: string;
  id: string;
  name?: string;
  capabilities: {
    imageInput: "none" | "single" | "multiple";
    n: boolean;
    size: boolean;
    qualityValues: string[];
  };
  defaults?: JsonObject;
  parameterMap?: Partial<Record<"prompt" | "image" | "n" | "size" | "quality", string>>;
  protocolOverrides?: JsonObject;
};

export type GenericJsonProtocolConfig = {
  type: "generic-json";
  request: JsonObject;
  response: JsonObject;
  poll?: JsonObject;
};

export type ImageGenerateSettings = {
  version: 1;
  defaultModel?: string;
  outputDir: string;
  limits: {
    requestTimeoutMs: number;
    pollIntervalMs: number;
    maxPollAttempts: number;
    maxResponseBytes: number;
    maxImageBytes: number;
    maxInputImages: number;
    maxOutputImages: number;
  };
  providers: Record<string, ProviderConfig>;
  protocols: Record<string, GenericJsonProtocolConfig>;
  models: Record<string, ModelConfig>;
};

export type RemoteModel = {
  id: string;
  name?: string;
  description?: string;
};

export type ConfigIssue = { path: string; message: string };
