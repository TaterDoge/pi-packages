import { describe, expect, test } from "bun:test";
import extension from "../src/index.ts";

describe("pi-image-generate extension shell", () => {
  test("registers the tool, command, and lifecycle", () => {
    const tools = [];
    const commands = new Map();
    const events = [];
    extension({
      on: (name) => events.push(name),
      registerTool: (tool) => tools.push(tool),
      registerCommand: (name, command) => commands.set(name, command),
      registerMessageRenderer() {},
    });

    expect(events).toContain("session_start");
    expect(events).toContain("session_shutdown");
    expect(tools[0]?.name).toBe("image_generate");
    expect(tools[0]?.parameters.properties).not.toHaveProperty("model");
    expect(commands.has("image-generate")).toBeTrue();
  });

  test("completes all command names", () => {
    const commands = new Map();
    extension({
      on() {},
      registerTool() {},
      registerCommand: (name, command) => commands.set(name, command),
      registerMessageRenderer() {},
    });
    const completions = commands.get("image-generate").getArgumentCompletions("");
    expect(completions.map((item) => item.value)).toEqual([
      "generate",
      "settings",
      "list",
      "status",
      "reload",
      "help",
    ]);
  });
});
