import { describe, expect, test } from "bun:test";
import { formatTask, GenerationTaskManager } from "../src/task-manager.ts";

describe("GenerationTaskManager", () => {
  test("tracks phases, listeners, success, and bounded history", () => {
    let now = 1000;
    let id = 0;
    const manager = new GenerationTaskManager({
      historyLimit: 2,
      now: () => now++,
      id: () => `t${++id}`,
    });
    const phases = [];
    manager.subscribe((task) => phases.push(task.phase));
    const first = manager.start({ source: "tool", provider: "p", model: "m", remoteModel: "r" });
    expect(first.task.id).toBe("t1");
    manager.update("preparing");
    manager.update("requesting");
    const done = manager.succeed(["/tmp/a.png"]);
    expect(done.phase).toBe("succeeded");
    expect(manager.get("t1").outputPaths).toEqual(["/tmp/a.png"]);
    expect(phases).toEqual(["queued", "preparing", "requesting", "succeeded"]);
  });

  test("allows only one active task and returns its id", () => {
    const manager = new GenerationTaskManager({ id: () => "active" });
    manager.start({ source: "command", provider: "p", model: "m", remoteModel: "r" });
    expect(() =>
      manager.start({ source: "tool", provider: "p", model: "m", remoteModel: "r" }),
    ).toThrow("active");
  });

  test("aborts and records cancellation", () => {
    const manager = new GenerationTaskManager({ id: () => "cancel" });
    const { signal } = manager.start({
      source: "command",
      provider: "p",
      model: "m",
      remoteModel: "r",
    });
    const task = manager.cancel();
    expect(signal.aborted).toBeTrue();
    expect(task.phase).toBe("cancelled");
    expect(manager.get("cancel").error.message).not.toContain("prompt");
  });

  test("stores only sanitized failure details", () => {
    const manager = new GenerationTaskManager({ id: () => "failed" });
    manager.start({ source: "tool", provider: "p", model: "m", remoteModel: "r" });
    const task = manager.fail(new Error("secret-token=https://signed.test/?token=x"));
    expect(task.error.category).toBe("unexpected image generation error");
    expect(task.error.message).not.toContain("secret-token");
    expect(formatTask(task)).toContain("Status: failed");
  });
});
