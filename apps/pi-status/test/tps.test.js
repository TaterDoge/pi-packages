// fallow-ignore-file unused-file
import { describe, expect, test } from "bun:test";
import {
  onAgentEnd,
  onAgentStart,
  onMessageEnd,
  onMessageStart,
  onMessageUpdate,
} from "../src/components/tps.ts";

const message = (output, role = "assistant") => ({
  role,
  usage: output === undefined ? undefined : { output },
});

const delta = (value) => ({
  message: message(0),
  assistantMessageEvent: { type: "text_delta", delta: value },
});

describe("tps tracker", () => {
  test("estimates live throughput from streamed deltas", async () => {
    const state = { tpsLabel: "" };
    onAgentStart(state);
    expect(state.tpsLabel).toBe("0 tok/s");

    onMessageStart({ message: message(0) });
    // The first delta only starts the clock; throughput needs an elapsed window.
    onMessageUpdate(delta("x".repeat(200)), state, () => {});
    await Bun.sleep(5);
    onMessageUpdate(delta("x".repeat(200)), state, () => {});

    expect(state.tpsLabel).toMatch(/^\d+ tok\/s$/);
    expect(Number.parseInt(state.tpsLabel, 10)).toBeGreaterThan(0);
  });

  test("reports the run average and elapsed time on agent end", async () => {
    const state = { tpsLabel: "" };
    onAgentStart(state);
    onMessageStart({ message: message(0) });
    onMessageUpdate(delta("x".repeat(80)), state, () => {});
    await Bun.sleep(5);
    onMessageUpdate(delta("x".repeat(80)), state, () => {});
    onMessageEnd({ message: message(120) });
    onAgentEnd(state);

    expect(state.tpsLabel).toMatch(/^\d+ tok\/s \d+s$/);
  });

  test("ignores non-assistant messages", () => {
    const state = { tpsLabel: "untouched" };
    onAgentStart(state);
    onMessageStart({ message: message(0, "user") });
    onMessageUpdate(delta("hello"), state, () => {});
    onMessageEnd({ message: message(10, "user") });
    expect(state.tpsLabel).toBe("0 tok/s");
  });
});
