import { StringEnum } from "@earendil-works/pi-ai";
import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getDefaultImageGenerateSettings, loadImageGenerateSettings } from "./config.ts";
import { logErrorCategory, userErrorMessage } from "./errors.ts";
import { boundedDetails, formatCommandSummary, formatToolResult } from "./format.ts";
import { generateImage } from "./generate.ts";
import { openImagePreview } from "./image-preview.ts";
import {
  openSettingsBrowser,
  type SettingsServer,
  startSettingsServer,
} from "./settings-server.ts";
import { formatTask, GenerationTaskManager } from "./task-manager.ts";
import type { GenerateImageParams, GenerationTask, ImageGenerateSettings } from "./types.ts";

const SUBCOMMANDS = ["generate", "settings", "list", "status", "reload", "help"] as const;
const STATUS_KEY = "pi-image-generate";
const STATUS_SPINNER_FRAMES = ["◐", "◓", "◑", "◒"] as const;
const STATUS_SPINNER_INTERVAL_MS = 250;
const TERMINAL_PHASES = new Set(["succeeded", "failed", "cancelled"]);

export default function piImageGenerate(pi: ExtensionAPI): void {
  let settings = getDefaultImageGenerateSettings();
  let configError: string | undefined;
  let lastCtx: ExtensionContext | undefined;
  const taskManager = new GenerationTaskManager();
  let settingsServer: SettingsServer | undefined;
  let onUpdate: AgentToolUpdateCallback<Record<string, unknown>> | undefined;
  let statusSpinner: ReturnType<typeof setInterval> | undefined;
  let statusSpinnerIndex = 0;

  const clearStatusSpinner = () => {
    if (statusSpinner) clearInterval(statusSpinner);
    statusSpinner = undefined;
    statusSpinnerIndex = 0;
  };

  const syncStatus = (task?: GenerationTask) => {
    const ctx = lastCtx;
    if (!ctx) return;
    clearStatusSpinner();
    const text = task
      ? formatImageTaskStatus(task, statusSpinnerIndex)
      : configError || !settings.defaultModel
        ? "image: setup required"
        : `image: ready · ${settings.defaultModel}`;
    ctx.ui.setStatus(STATUS_KEY, text);
    if (task && !TERMINAL_PHASES.has(task.phase)) {
      statusSpinner = setInterval(() => {
        statusSpinnerIndex = (statusSpinnerIndex + 1) % STATUS_SPINNER_FRAMES.length;
        lastCtx?.ui.setStatus(STATUS_KEY, formatImageTaskStatus(task, statusSpinnerIndex));
      }, STATUS_SPINNER_INTERVAL_MS);
    }
    if (task) {
      onUpdate?.({
        content: [{ type: "text", text: `Image task ${task.id}: ${task.phase}` }],
        details: { taskId: task.id, phase: task.phase, model: task.model },
      });
    }
  };

  taskManager.subscribe((task) => syncStatus(task));

  const reload = async (ctx: ExtensionContext) => {
    lastCtx = ctx;
    const loaded = await loadImageGenerateSettings();
    settings = loaded.settings;
    configError = loaded.ok ? undefined : loaded.error;
    registerTool();
    syncStatus();
    return loaded;
  };

  const registerTool = () => {
    pi.registerTool({
      name: "image_generate",
      label: "Image Generate",
      description:
        "Generate or edit raster images with the fixed default model configured by /image-generate settings. This tool has no model parameter.",
      promptSnippet: "Generate or edit raster images with the configured image provider.",
      promptGuidelines: [
        "Use image_generate for bitmap assets and edits. The active model is fixed in global settings; never ask for or pass a model parameter.",
        "Use n only for variants of one prompt. For different assets, make separate calls.",
        "Generated images open in a browser preview tab. Report the saved paths returned by the tool.",
      ],
      parameters: buildToolParameters(settings) as never,
      executionMode: "sequential",
      async execute(_toolCallId, params: GenerateImageParams, signal, update, ctx) {
        lastCtx = ctx;
        onUpdate = update as AgentToolUpdateCallback<Record<string, unknown>> | undefined;
        ctx.ui.setWorkingMessage("Generating image…");
        try {
          if (configError) throw new Error(configError);
          const result = await generateImage(params, {
            cwd: ctx.cwd,
            settings,
            modelRegistry: ctx.modelRegistry,
            taskManager,
            source: "tool",
            ...(signal ? { signal } : {}),
          });
          const previewOpened = await openImagePreview(result.images);
          return {
            content: [
              {
                type: "text" as const,
                text: `${formatToolResult(result)}\n${previewOpened ? "Opened browser preview." : "Could not open browser preview."}`,
              },
            ],
            details: boundedDetails(result),
          };
        } catch (error) {
          console.error(`[pi-image-generate] ${logErrorCategory(error)}`);
          return {
            isError: true,
            content: [{ type: "text" as const, text: userErrorMessage(error) }],
            details: {},
          };
        } finally {
          onUpdate = undefined;
          ctx.ui.setWorkingMessage();
          syncStatus();
        }
      },
    });
  };

  registerTool();

  pi.on("session_start", async (_event, ctx) => {
    await reload(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    taskManager.cancel();
    clearStatusSpinner();
    await settingsServer?.close();
    settingsServer = undefined;
    ctx.ui.setStatus(STATUS_KEY, undefined);
    lastCtx = undefined;
  });

  pi.registerCommand("image-generate", {
    description:
      "Generate an image directly or manage settings. Subcommands: generate, settings, list, status, reload, help.",
    getArgumentCompletions: (prefix) => commandCompletions(prefix, taskManager),
    handler: async (args, ctx) => {
      lastCtx = ctx;
      const raw = args.trim();
      const [firstRaw] = raw.split(/\s+/, 1);
      const first = firstRaw?.toLowerCase();
      if (!raw || first === "help") {
        ctx.ui.notify(helpText(), "info");
        return;
      }
      if (first === "settings") {
        await settingsServer?.close();
        settingsServer = await startSettingsServer({
          settings,
          modelRegistry: ctx.modelRegistry,
        });
        openSettingsBrowser(settingsServer.url);
        ctx.ui.notify(`Image settings opened in your browser.\n${settingsServer.url}`, "info");
        const activeServer = settingsServer;
        const saved = await activeServer.result;
        if (settingsServer === activeServer) settingsServer = undefined;
        if (saved) {
          await reload(ctx);
          ctx.ui.notify("Image generation settings saved and reloaded.", "info");
        }
        return;
      }
      if (first === "reload") {
        const loaded = await reload(ctx);
        ctx.ui.notify(
          loaded.ok ? "Image generation settings reloaded." : loaded.error,
          loaded.ok ? "info" : "error",
        );
        return;
      }
      if (first === "list") {
        ctx.ui.notify(await listText(settings, ctx, raw.slice(firstRaw.length).trim()), "info");
        return;
      }
      if (first === "status") {
        const id = raw.slice(firstRaw.length).trim() || undefined;
        ctx.ui.notify(formatTask(taskManager.get(id)), "info");
        return;
      }
      const prompt = first === "generate" ? raw.slice(firstRaw.length).trim() : raw;
      if (!prompt) {
        ctx.ui.notify("Usage: /image-generate <prompt>", "warning");
        return;
      }
      await runCommandGenerate(prompt, ctx);
    },
  });

  async function runCommandGenerate(prompt: string, ctx: ExtensionCommandContext): Promise<void> {
    try {
      if (configError) throw new Error(configError);
      const result = await generateImage(
        { prompt },
        {
          cwd: ctx.cwd,
          settings,
          modelRegistry: ctx.modelRegistry,
          taskManager,
          source: "command",
          ...(ctx.signal ? { signal: ctx.signal } : {}),
        },
      );
      const summary = formatCommandSummary(result);
      const previewOpened = await openImagePreview(result.images);
      ctx.ui.notify(
        `${summary}\n${previewOpened ? "Opened browser preview." : "Could not open browser preview."}`,
        previewOpened ? "info" : "warning",
      );
    } catch (error) {
      console.error(`[pi-image-generate] ${logErrorCategory(error)}`);
      ctx.ui.notify(userErrorMessage(error), "error");
    } finally {
      syncStatus();
    }
  }
}

export function formatImageTaskStatus(task: GenerationTask, frameIndex: number): string {
  const icon = TERMINAL_PHASES.has(task.phase)
    ? task.phase === "succeeded"
      ? "✓"
      : "!"
    : STATUS_SPINNER_FRAMES[frameIndex % STATUS_SPINNER_FRAMES.length];
  return `${icon} image: ${task.phase}`;
}

export function buildToolParameters(settings: ImageGenerateSettings) {
  const model = settings.defaultModel ? settings.models[settings.defaultModel] : undefined;
  const capabilities = model?.capabilities;
  return Type.Object({
    prompt: Type.String({ description: "What to generate or change." }),
    ...(capabilities?.imageInput !== "none"
      ? {
          image: Type.Optional(
            Type.Array(Type.String(), {
              maxItems: capabilities?.imageInput === "single" ? 1 : settings.limits.maxInputImages,
              description: "Input/reference image file paths or HTTP(S) URLs.",
            }),
          ),
        }
      : {}),
    ...(capabilities?.n
      ? {
          n: Type.Optional(Type.Integer({ minimum: 1, maximum: settings.limits.maxOutputImages })),
        }
      : {}),
    ...(capabilities?.size
      ? { size: Type.Optional(Type.String({ description: "Provider-specific image size." })) }
      : {}),
    ...(capabilities?.qualityValues.length
      ? {
          quality: Type.Optional(
            StringEnum(capabilities.qualityValues, {
              description: "Quality supported by the fixed default model.",
            }),
          ),
        }
      : {}),
    filename: Type.Optional(Type.String({ description: "Output filename prefix." })),
    outputDir: Type.Optional(Type.String({ description: "Output directory for this call." })),
  });
}

function commandCompletions(prefix: string, taskManager: GenerationTaskManager) {
  const normalized = prefix.toLowerCase();
  const space = normalized.indexOf(" ");
  if (space < 0) {
    return SUBCOMMANDS.filter((command) => command.startsWith(normalized.trim())).map(
      (command) => ({
        label: command,
        value: command,
        description: commandDescription(command),
      }),
    );
  }
  const command = normalized.slice(0, space).trim();
  const rest = normalized.slice(space + 1).trim();
  if (command === "list") {
    return ["providers", "models", "protocols"]
      .filter((value) => value.startsWith(rest))
      .map((value) => ({ label: value, value: `list ${value}` }));
  }
  if (command === "status") {
    return taskManager
      .listRecent()
      .filter((task) => task.id.toLowerCase().startsWith(rest))
      .map((task) => ({ label: task.id, value: `status ${task.id}`, description: task.phase }));
  }
  return null;
}

function commandDescription(command: (typeof SUBCOMMANDS)[number]): string {
  switch (command) {
    case "generate":
      return "Generate with the fixed default model";
    case "settings":
      return "Open settings in your browser";
    case "list":
      return "List configured providers, models, or protocols";
    case "status":
      return "Show active or recent generation tasks";
    case "reload":
      return "Reload global image settings";
    case "help":
      return "Show command help";
  }
}

async function listText(
  settings: ImageGenerateSettings,
  ctx: ExtensionContext,
  section: string,
): Promise<string> {
  const wanted = section.toLowerCase();
  const lines: string[] = [];
  if (!wanted || wanted === "providers") {
    lines.push("Providers:");
    for (const [id, provider] of Object.entries(settings.providers)) {
      const auth =
        provider.credential?.source === "pi-auth"
          ? ctx.modelRegistry.getProviderAuthStatus(id).configured
            ? "configured"
            : "missing"
          : provider.credential
            ? provider.credential.source
            : "none";
      lines.push(`  ${id} · ${provider.protocol} · auth: ${auth}`);
    }
    if (Object.keys(settings.providers).length === 0) lines.push("  (none)");
  }
  if (!wanted || wanted === "models") {
    if (lines.length) lines.push("");
    lines.push("Models:");
    for (const [id, model] of Object.entries(settings.models)) {
      lines.push(
        `  ${id}${id === settings.defaultModel ? " (default)" : ""} → ${model.provider}/${model.id}`,
      );
    }
    if (Object.keys(settings.models).length === 0) lines.push("  (none)");
  }
  if (!wanted || wanted === "protocols") {
    if (lines.length) lines.push("");
    lines.push("Protocols:", "  openai-images (built-in)", "  gemini-generate-content (built-in)");
    for (const id of Object.keys(settings.protocols)) lines.push(`  ${id} (generic-json)`);
  }
  if (wanted && !["providers", "models", "protocols"].includes(wanted)) {
    return "Usage: /image-generate list [providers|models|protocols]";
  }
  return lines.join("\n");
}

function helpText(): string {
  return [
    "Image generate commands:",
    "  /image-generate <prompt>",
    "  /image-generate generate <prompt>",
    "  /image-generate settings",
    "  /image-generate list [providers|models|protocols]",
    "  /image-generate status [task-id]",
    "  /image-generate reload",
    "  /image-generate help",
    "The model is fixed by global settings; switch it only in settings.",
  ].join("\n");
}
