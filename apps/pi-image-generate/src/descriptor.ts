import {
  loadImageGenerateSettings,
  validateImageGenerateSettings,
  writeImageGenerateSettings,
} from "./config.ts";
import type { PiCredentialResolver } from "./credentials.ts";
import { discoverProviderModels } from "./model-discovery.ts";
import type { SettingsDescriptor, SettingsField } from "./settings/types.ts";
import type { ImageGenerateSettings } from "./types.ts";
import { BUILT_IN_PROTOCOLS } from "./types.ts";

export type ImageSettingsRuntime = {
  modelRegistry?: PiCredentialResolver;
  fetchImpl?: typeof fetch;
  agentDir?: string;
};

const CREDENTIAL_FIELDS: SettingsField[] = [
  {
    kind: "select",
    path: "credential.source",
    label: "Credential source",
    options: [
      { label: "none", value: "" },
      { label: "env", value: "env" },
      { label: "literal", value: "literal" },
      { label: "pi-auth", value: "pi-auth" },
    ],
  },
  {
    kind: "password",
    path: "credential.value",
    label: "API key / token",
    visibleWhen: { path: "credential.source", in: ["literal"] },
  },
  {
    kind: "text",
    path: "credential.value",
    label: "Environment variable",
    visibleWhen: { path: "credential.source", in: ["env"] },
  },
];

const PROVIDER_FIELDS: SettingsField[] = [
  { kind: "text", path: "name", label: "Display name" },
  { kind: "text", path: "baseUrl", label: "Base URL", placeholder: "https://" },
  {
    kind: "select",
    path: "protocol",
    label: "Protocol",
    from: { path: "protocols" },
    extraOptions: BUILT_IN_PROTOCOLS.map((id) => ({ label: id, value: id })),
  },
  ...CREDENTIAL_FIELDS,
  { kind: "json", path: "headers", label: "Secret headers JSON" },
];

const MODEL_FIELDS: SettingsField[] = [
  { kind: "text", path: "name", label: "Display name" },
  { kind: "select", path: "provider", label: "Provider", from: { path: "providers" } },
  { kind: "text", path: "id", label: "Remote model ID", mono: true },
  {
    kind: "select",
    path: "capabilities.imageInput",
    label: "Image input",
    options: [
      { label: "none", value: "none" },
      { label: "single", value: "single" },
      { label: "multiple", value: "multiple" },
    ],
  },
  {
    kind: "tags",
    path: "capabilities.qualityValues",
    label: "Quality values",
    placeholder: "standard, high",
  },
  { kind: "switch", path: "capabilities.n", label: "Multiple outputs (n)" },
  { kind: "switch", path: "capabilities.size", label: "Custom size" },
  { kind: "json", path: "defaults", label: "Defaults JSON" },
  { kind: "json", path: "parameterMap", label: "Parameter map JSON" },
  { kind: "json", path: "protocolOverrides", label: "Protocol overrides JSON" },
];

const PROTOCOL_FIELDS: SettingsField[] = [
  { kind: "json", path: "request", label: "Request template" },
  { kind: "json", path: "response", label: "Response mapping" },
  { kind: "json", path: "poll", label: "Polling (optional)" },
];

const LIMIT_FIELDS: SettingsField[] = [
  { kind: "number", path: "limits.requestTimeoutMs", label: "Request timeout (ms)", min: 1 },
  { kind: "number", path: "limits.pollIntervalMs", label: "Poll interval (ms)", min: 1 },
  { kind: "number", path: "limits.maxPollAttempts", label: "Max poll attempts", min: 1 },
  { kind: "number", path: "limits.maxResponseBytes", label: "Max response bytes", min: 1 },
  { kind: "number", path: "limits.maxImageBytes", label: "Max image bytes", min: 1 },
  { kind: "number", path: "limits.maxInputImages", label: "Max input images", min: 1 },
  { kind: "number", path: "limits.maxOutputImages", label: "Max output images", min: 1 },
];

export function createImageGenerateDescriptor(
  runtime: ImageSettingsRuntime,
): SettingsDescriptor<ImageGenerateSettings> {
  return {
    id: "pi-image-generate",
    title: "Image Generator",
    subtitle: "Providers, models and limits for the image_generate tool",
    // Literal secrets only: env names and pi-auth references are not sensitive.
    secrets: ["providers.*.credential.value", "providers.*.headers.*.value.value"],

    load: async () => (await loadImageGenerateSettings(runtime.agentDir)).settings,

    validate: (draft) => {
      const validated = validateImageGenerateSettings(draft);
      return validated.ok
        ? { ok: true, value: validated.settings }
        : { ok: false, issues: validated.issues };
    },

    save: (value) => writeImageGenerateSettings(value, runtime.agentDir),

    // Deleting a provider cascades to its models and to a default that pointed at one of them;
    // deleting a model clears the default. The config validator rejects dangling references.
    onDeleteRecordItem: (draft, recordPath, id) => {
      const next = structuredClone(draft) as ImageGenerateSettings;
      if (recordPath === "providers") {
        delete next.providers[id];
        for (const [modelId, model] of Object.entries(next.models)) {
          if (model.provider !== id) continue;
          delete next.models[modelId];
          if (next.defaultModel === modelId) delete next.defaultModel;
        }
        return next;
      }
      if (recordPath === "models") {
        delete next.models[id];
        if (next.defaultModel === id) delete next.defaultModel;
      }
      return next;
    },

    ui: {
      sections: [
        {
          id: "general",
          label: "General",
          title: "Runtime defaults",
          description: "The tool schema follows the selected model.",
          fields: [
            {
              kind: "select",
              path: "defaultModel",
              label: "Default model",
              from: { path: "models" },
              allowEmpty: true,
              placeholder: "Add a model first",
            },
            { kind: "text", path: "outputDir", label: "Output directory", mono: true },
            ...LIMIT_FIELDS,
          ],
        },
        {
          id: "providers",
          label: "Providers",
          title: "Provider gateways",
          description: "Define HTTP endpoints and where credentials are resolved.",
          fields: [
            {
              kind: "record",
              path: "providers",
              label: "Providers",
              itemCode: "provider",
              addLabel: "Add provider",
              newItem: { baseUrl: "https://", protocol: "openai-images" },
              fields: PROVIDER_FIELDS,
            },
          ],
        },
        {
          id: "models",
          label: "Models",
          title: "Models",
          description: "Models define which arguments the image_generate tool exposes.",
          fields: [
            {
              kind: "record",
              path: "models",
              label: "Models",
              itemCode: "model",
              addLabel: "Add manually",
              newItem: {
                provider: "",
                id: "",
                capabilities: { imageInput: "none", n: false, size: false, qualityValues: [] },
              },
              fields: MODEL_FIELDS,
            },
          ],
        },
        {
          id: "protocols",
          label: "Protocols",
          title: "Request protocols",
          description:
            "Built-ins cover OpenAI Images and Gemini. Add generic JSON only for other APIs.",
          fields: [
            {
              kind: "record",
              path: "protocols",
              label: "Generic protocols",
              itemCode: "protocol",
              addLabel: "Add generic protocol",
              newItem: {
                type: "generic-json",
                request: { url: "generate" },
                response: { imagePaths: ["data.*.url"] },
              },
              fields: PROTOCOL_FIELDS,
            },
          ],
        },
      ],
    },

    actions: {
      "discover-models": async (draft, context) => {
        const settings = draft as ImageGenerateSettings;
        const providerId = (context.args as { providerId?: string } | undefined)?.providerId;
        if (!providerId) return { models: [] };
        const provider = settings.providers[providerId];
        if (!provider) return { models: [] };
        return {
          models: await discoverProviderModels({
            providerId,
            provider,
            settings,
            modelRegistry: runtime.modelRegistry ?? {
              getApiKeyForProvider: async () => undefined,
            },
            fetchImpl: runtime.fetchImpl,
          }),
        };
      },
    },
  };
}
