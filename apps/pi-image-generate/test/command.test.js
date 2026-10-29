import { describe, expect, test } from "bun:test";
import extension from "../src/index.ts";

function setup() {
  const commands = new Map();
  const handlers = new Map();
  const pi = {
    registerTool() {},
    registerMessageRenderer() {},
    registerCommand: (name, command) => commands.set(name, command),
    on: (name, handler) => handlers.set(name, handler),
  };
  extension(pi);
  const notices = [];
  const ctx = {
    cwd: "/tmp",
    ui: {
      notify: (message, kind) => notices.push({ message, kind }),
      setStatus() {},
      setWorkingMessage() {},
    },
    modelRegistry: {
      getApiKeyForProvider: async () => undefined,
      getProviderAuthStatus: () => ({ configured: false }),
    },
  };
  return { command: commands.get("image-generate"), handlers, notices, ctx };
}

describe("/image-generate command", () => {
  test("offers first and second-level completions", () => {
    const { command } = setup();
    expect(command.getArgumentCompletions("").map((item) => item.value)).toEqual([
      "generate",
      "settings",
      "list",
      "status",
      "reload",
      "help",
    ]);
    expect(command.getArgumentCompletions("list ").map((item) => item.value)).toEqual([
      "list providers",
      "list models",
      "list protocols",
    ]);
  });

  test("treats non-subcommand text as the direct prompt", async () => {
    const { command, notices, ctx } = setup();
    await command.handler("a watercolor corgi", ctx);
    expect(notices.at(-1).message).toContain("No default image model");
  });

  test("shows help and config lists without exposing secrets", async () => {
    const { command, notices, ctx } = setup();
    await command.handler("help", ctx);
    expect(notices.at(-1).message).toContain("/image-generate <prompt>");
    await command.handler("list", ctx);
    expect(notices.at(-1).message).toContain("Providers:");
  });
});
