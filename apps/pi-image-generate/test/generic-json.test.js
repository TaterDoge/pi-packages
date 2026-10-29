import { describe, expect, test } from "bun:test";
import { createGenericJsonProtocol } from "../src/protocols/generic-json.ts";

const PNG_B64 = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
const limits = {
  requestTimeoutMs: 1000,
  pollIntervalMs: 1,
  maxPollAttempts: 4,
  maxResponseBytes: 100000,
  maxImageBytes: 100000,
  maxInputImages: 8,
  maxOutputImages: 8,
};
function context(fetchImpl, signal) {
  return {
    providerId: "queue",
    provider: { baseUrl: "https://queue.test/v1", protocol: "custom-queue" },
    model: {
      provider: "queue",
      id: "flux",
      capabilities: { imageInput: "multiple", n: true, size: true, qualityValues: [] },
    },
    params: { prompt: "a cat", n: 1 },
    inputs: [],
    apiKey: "secret",
    headers: {},
    fetchImpl,
    limits,
    signal,
  };
}
function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("generic-json protocol", () => {
  test("runs a synchronous template and extracts wildcard images", async () => {
    let body;
    const protocol = createGenericJsonProtocol({
      type: "generic-json",
      request: { url: "generate", body: { model: "{model}", prompt: "{prompt}", n: "{n}" } },
      response: { imagePaths: ["output.images.*.url"] },
    });
    const result = await protocol.generate(
      context(async (_url, init) => {
        body = JSON.parse(init.body);
        return response({ output: { images: [{ url: "https://cdn.test/a.png" }] } });
      }),
    );
    expect(body).toEqual({ model: "flux", prompt: "a cat", n: 1 });
    expect(result[0].data.url).toBe("https://cdn.test/a.png");
  });

  test("submits, polls, and fetches the final result", async () => {
    const calls = [];
    const protocol = createGenericJsonProtocol({
      type: "generic-json",
      request: { url: "jobs", body: { input: "{prompt}" } },
      poll: {
        request: { method: "GET", url: "jobs/{taskId}" },
        taskIdPath: "id",
        statusPath: "status",
        successStatuses: ["succeeded"],
        failureStatuses: ["failed"],
        resultRequest: { method: "GET", url: "jobs/{taskId}/result" },
        intervalMs: 1,
        maxAttempts: 3,
      },
      response: { imagePaths: ["images.*.b64"] },
    });
    const result = await protocol.generate(
      context(async (url) => {
        calls.push(url);
        if (url.endsWith("/jobs")) return response({ id: "task-1" });
        if (url.endsWith("/result")) return response({ images: [{ b64: PNG_B64 }] });
        return response({ status: calls.length < 3 ? "running" : "succeeded" });
      }),
    );
    expect(calls).toEqual([
      "https://queue.test/v1/jobs",
      "https://queue.test/v1/jobs/task-1",
      "https://queue.test/v1/jobs/task-1",
      "https://queue.test/v1/jobs/task-1/result",
    ]);
    expect(result[0].data.kind).toBe("base64");
  });

  test("surfaces provider failure, unknown status exhaustion, 429, and cancellation", async () => {
    const failed = createGenericJsonProtocol({
      type: "generic-json",
      request: { url: "jobs" },
      poll: {
        request: { method: "GET", url: "jobs/{taskId}" },
        taskIdPath: "id",
        statusPath: "status",
        successStatuses: ["done"],
        failureStatuses: ["failed"],
        maxAttempts: 1,
      },
      response: { imagePaths: ["image"] },
    });
    let call = 0;
    await expect(
      failed.generate(
        context(async () => response(call++ === 0 ? { id: "x" } : { status: "failed" })),
      ),
    ).rejects.toThrow("reported");
    call = 0;
    await expect(
      failed.generate(
        context(async () => response(call++ === 0 ? { id: "x" } : { status: "mystery" })),
      ),
    ).rejects.toThrow("polling limit");
    await expect(
      createGenericJsonProtocol({
        type: "generic-json",
        request: { url: "jobs" },
        response: { imagePaths: ["image"] },
      }).generate(context(async () => response({}, 429))),
    ).rejects.toThrow("rate-limited");
    const controller = new AbortController();
    controller.abort();
    await expect(
      failed.generate(context(async () => response({ id: "x" }), controller.signal)),
    ).rejects.toThrow("cancelled");
  });
});
