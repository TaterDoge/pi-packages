import { describe, expect, test } from "bun:test";
import { resolveCredential, resolveHeaderReferences } from "../src/credentials.ts";

const registry = (value) => ({ getApiKeyForProvider: async () => value });

describe("credential resolution", () => {
  test("resolves an environment reference", async () => {
    expect(
      await resolveCredential(
        { source: "env", value: "IMAGE_KEY" },
        "studio",
        registry(undefined),
        { env: { IMAGE_KEY: "secret-value" } },
      ),
    ).toBe("secret-value");
  });

  test("resolves Pi auth by provider id", async () => {
    expect(await resolveCredential({ source: "pi-auth" }, "studio", registry("pi-secret"))).toBe(
      "pi-secret",
    );
  });

  test("resolves a stored string", async () => {
    expect(
      await resolveCredential(
        { source: "literal", value: "stored-secret" },
        "studio",
        registry(undefined),
      ),
    ).toBe("stored-secret");
  });

  test("resolves secret header references without exposing them in keys", async () => {
    const headers = await resolveHeaderReferences(
      [{ name: "X-API-Key", value: { source: "env", value: "HEADER_KEY" } }],
      "studio",
      registry(undefined),
      { env: { HEADER_KEY: "header-secret" } },
    );
    expect(headers).toEqual({ "X-API-Key": "header-secret" });
  });
});
