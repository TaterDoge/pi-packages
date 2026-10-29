import { randomUUID } from "node:crypto";
import { ImageGenerateError, logErrorCategory, userErrorMessage } from "./errors.ts";
import type { GenerationPhase, GenerationSource, GenerationTask } from "./types.ts";

const TERMINAL_PHASES = new Set<GenerationPhase>(["succeeded", "failed", "cancelled"]);

export class GenerationTaskManager {
  private active?: GenerationTask;
  private readonly recent: GenerationTask[] = [];
  private readonly listeners = new Set<(task: GenerationTask) => void>();
  private controller?: AbortController;

  constructor(
    private readonly options: { historyLimit?: number; now?: () => number; id?: () => string } = {},
  ) {}

  start(input: {
    source: GenerationSource;
    provider: string;
    model: string;
    remoteModel: string;
  }): { task: GenerationTask; signal: AbortSignal } {
    if (this.active && !TERMINAL_PHASES.has(this.active.phase)) {
      throw new ImageGenerateError(
        `Image task ${this.active.id} is already running. Use /image-generate status ${this.active.id}.`,
        "generation-task-already-active",
      );
    }
    const now = this.now();
    const task: GenerationTask = {
      id: this.options.id?.() ?? randomUUID().slice(0, 8),
      source: input.source,
      provider: input.provider,
      model: input.model,
      remoteModel: input.remoteModel,
      phase: "queued",
      startedAt: now,
      updatedAt: now,
    };
    this.controller = new AbortController();
    this.active = task;
    this.emit(task);
    return { task: cloneTask(task), signal: this.controller.signal };
  }

  update(phase: Exclude<GenerationPhase, "succeeded" | "failed" | "cancelled">): GenerationTask {
    const task = this.requireActive();
    task.phase = phase;
    task.updatedAt = this.now();
    this.emit(task);
    return cloneTask(task);
  }

  succeed(outputPaths: string[]): GenerationTask {
    return this.finish("succeeded", {
      outputPaths: [...outputPaths],
      imageCount: outputPaths.length,
    });
  }

  fail(error: unknown): GenerationTask {
    return this.finish("failed", {
      error: { category: logErrorCategory(error), message: userErrorMessage(error) },
    });
  }

  cancel(): GenerationTask | undefined {
    const task = this.active;
    if (!task || TERMINAL_PHASES.has(task.phase)) return task ? cloneTask(task) : undefined;
    this.controller?.abort(new Error("cancelled"));
    return this.finish("cancelled", {
      error: { category: "generation-cancelled", message: "Image generation was cancelled." },
    });
  }

  getActive(): GenerationTask | undefined {
    return this.active && !TERMINAL_PHASES.has(this.active.phase)
      ? cloneTask(this.active)
      : undefined;
  }

  get(id?: string): GenerationTask | undefined {
    if (!id) return this.getActive() ?? cloneTask(this.recent[0]);
    if (this.active?.id === id) return cloneTask(this.active);
    const task = this.recent.find((entry) => entry.id === id);
    return cloneTask(task);
  }

  listRecent(): GenerationTask[] {
    return this.recent.map((task) => cloneTask(task));
  }

  subscribe(listener: (task: GenerationTask) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private finish(
    phase: "succeeded" | "failed" | "cancelled",
    patch: Pick<GenerationTask, "outputPaths" | "imageCount" | "error">,
  ): GenerationTask {
    const task = this.requireActive();
    const now = this.now();
    task.phase = phase;
    task.updatedAt = now;
    task.finishedAt = now;
    if (patch.outputPaths) task.outputPaths = patch.outputPaths;
    if (patch.imageCount !== undefined) task.imageCount = patch.imageCount;
    if (patch.error) task.error = patch.error;
    this.emit(task);
    this.recent.unshift(cloneTask(task));
    this.recent.splice(this.options.historyLimit ?? 10);
    this.active = undefined;
    this.controller = undefined;
    return cloneTask(task);
  }

  private requireActive(): GenerationTask {
    if (!this.active || TERMINAL_PHASES.has(this.active.phase)) {
      throw new ImageGenerateError(
        "No image generation task is active.",
        "generation-task-not-active",
      );
    }
    return this.active;
  }

  private emit(task: GenerationTask): void {
    const value = cloneTask(task);
    for (const listener of this.listeners) listener(value);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

export function formatTask(task: GenerationTask | undefined): string {
  if (!task) return "No image generation task is active or recent.";
  const elapsedEnd = task.finishedAt ?? task.updatedAt;
  const lines = [
    `Task: ${task.id}`,
    `Status: ${task.phase}`,
    `Source: ${task.source}`,
    `Model: ${task.model}`,
    `Provider: ${task.provider}`,
    `Elapsed: ${Math.max(0, Math.round((elapsedEnd - task.startedAt) / 1000))}s`,
  ];
  if (task.outputPaths?.length)
    lines.push("Files:", ...task.outputPaths.map((value) => `  ${value}`));
  if (task.error) lines.push(`Error: ${task.error.message}`);
  return lines.join("\n");
}

function cloneTask(task: GenerationTask): GenerationTask;
function cloneTask(task: GenerationTask | undefined): GenerationTask | undefined;
function cloneTask(task: GenerationTask | undefined): GenerationTask | undefined {
  return task ? structuredClone(task) : undefined;
}
