import {
  type PiCredentialResolver,
  resolveCredential,
  resolveHeaderReferences,
} from "./credentials.ts";
import { ImageGenerateError } from "./errors.ts";
import {
  materializeImage,
  resolveOutputDirectory,
  timestampFilename,
  writeUniqueImage,
} from "./files.ts";
import { resolveImageInputs } from "./image-input.ts";
import { resolveProtocol } from "./protocols/index.ts";
import type { GenerationTaskManager } from "./task-manager.ts";
import type {
  GenerateImageParams,
  GenerationSource,
  ImageGenerateResult,
  ImageGenerateSettings,
} from "./types.ts";

export type GenerateImageOptions = {
  cwd: string;
  settings: ImageGenerateSettings;
  modelRegistry: PiCredentialResolver;
  taskManager: GenerationTaskManager;
  source: GenerationSource;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export async function generateImage(
  params: GenerateImageParams,
  options: GenerateImageOptions,
): Promise<ImageGenerateResult> {
  const prompt = params.prompt.trim();
  if (!prompt) throw new ImageGenerateError("Image prompt is empty.", "image-prompt-empty");
  const modelKey = options.settings.defaultModel;
  if (!modelKey) {
    throw new ImageGenerateError(
      "No default image model is configured. Open /image-generate settings.",
      "default-model-missing",
    );
  }
  const model = options.settings.models[modelKey];
  if (!model) {
    throw new ImageGenerateError(
      "The configured default image model no longer exists. Open /image-generate settings.",
      "default-model-invalid",
    );
  }
  const provider = options.settings.providers[model.provider];
  if (!provider) {
    throw new ImageGenerateError(
      "The default model references a missing provider. Open /image-generate settings.",
      "model-provider-missing",
    );
  }
  validateParams(params, model.capabilities, options.settings.limits.maxOutputImages);
  const started = options.taskManager.start({
    source: options.source,
    provider: model.provider,
    model: modelKey,
    remoteModel: model.id,
  });
  const signal = combineSignals(options.signal, started.signal);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    options.taskManager.update("preparing");
    const [apiKey, headers, inputs] = await Promise.all([
      resolveCredential(provider.credential, model.provider, options.modelRegistry),
      resolveHeaderReferences(provider.headers, model.provider, options.modelRegistry),
      resolveImageInputs(params.image, options.cwd, fetchImpl, options.settings.limits, signal),
    ]);
    if (model.capabilities.imageInput === "single" && inputs.length > 1) {
      throw new ImageGenerateError(
        "The default model accepts only one input image.",
        "model-input-count-invalid",
      );
    }
    const protocol = resolveProtocol(provider, options.settings);
    options.taskManager.update("requesting");
    const rawImages = await protocol.generate({
      providerId: model.provider,
      provider,
      model,
      params: { ...params, prompt },
      inputs,
      ...(apiKey ? { apiKey } : {}),
      headers,
      fetchImpl,
      signal,
      limits: options.settings.limits,
      onPhase: (phase) => options.taskManager.update(phase),
    });
    const outputDirectory = resolveOutputDirectory(
      params.outputDir ?? options.settings.outputDir,
      options.cwd,
    );
    const baseName =
      params.filename?.trim() || timestampFilename(modelKey, options.now?.() ?? new Date());
    const images = [];
    for (const [index, raw] of rawImages.entries()) {
      if (raw.data.kind === "url") options.taskManager.update("downloading");
      const materialized = await materializeImage(raw, fetchImpl, options.settings.limits, signal);
      options.taskManager.update("saving");
      const path = await writeUniqueImage(
        outputDirectory,
        rawImages.length > 1 ? `${baseName}-${index + 1}` : baseName,
        materialized.mimeType,
        materialized.bytes,
        signal,
      );
      images.push({
        path,
        mimeType: materialized.mimeType,
        data: Buffer.from(materialized.bytes).toString("base64"),
        ...(materialized.revisedPrompt ? { revisedPrompt: materialized.revisedPrompt } : {}),
      });
    }
    options.taskManager.succeed(images.map((image) => image.path));
    return {
      provider: model.provider,
      model: modelKey,
      remoteModel: model.id,
      taskId: started.task.id,
      images,
    };
  } catch (error) {
    if (signal.aborted) {
      options.taskManager.cancel();
      throw new ImageGenerateError("Image generation was cancelled.", "generation-cancelled");
    }
    options.taskManager.fail(error);
    throw error;
  }
}

function validateParams(
  params: GenerateImageParams,
  capabilities: ImageGenerateSettings["models"][string]["capabilities"],
  maxOutputImages: number,
): void {
  if (params.image?.length && capabilities.imageInput === "none") {
    throw new ImageGenerateError(
      "The default model does not accept input images.",
      "model-image-input-unsupported",
    );
  }
  if (params.n !== undefined) {
    if (!capabilities.n && params.n !== 1) {
      throw new ImageGenerateError(
        "The default model does not support multiple outputs.",
        "model-n-unsupported",
      );
    }
    if (!Number.isInteger(params.n) || params.n < 1 || params.n > maxOutputImages) {
      throw new ImageGenerateError(
        `Image count must be an integer from 1 to ${maxOutputImages}.`,
        "image-count-invalid",
      );
    }
  }
  if (params.size && !capabilities.size) {
    throw new ImageGenerateError(
      "The default model does not expose a size parameter.",
      "model-size-unsupported",
    );
  }
  if (params.quality) {
    if (!capabilities.qualityValues.includes(params.quality)) {
      throw new ImageGenerateError(
        "The selected quality is not supported by the default model.",
        "model-quality-invalid",
      );
    }
  }
}

function combineSignals(first: AbortSignal | undefined, second: AbortSignal): AbortSignal {
  if (!first) return second;
  if (first.aborted) return first;
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  first.addEventListener("abort", () => abort(first), { once: true });
  second.addEventListener("abort", () => abort(second), { once: true });
  return controller.signal;
}
