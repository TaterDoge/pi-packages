import { describe, expect, test } from "bun:test";
import {
  extractFirst,
  extractPath,
  parsePath,
  renderTemplate,
  validateTemplateVariables,
} from "../src/protocols/template.ts";

describe("protocol templates", () => {
  test("keeps native values for a full variable and interpolates scalars", () => {
    const rendered = renderTemplate(
      {
        model: "{model}",
        prompt: "prefix {prompt}",
        n: "{n}",
        images: "{imageDataUris}",
      },
      {
        model: "flux",
        prompt: "a cat",
        n: 2,
        imageDataUris: ["data:image/png;base64,AA=="],
      },
    );
    expect(rendered).toEqual({
      model: "flux",
      prompt: "prefix a cat",
      n: 2,
      images: ["data:image/png;base64,AA=="],
    });
  });

  test("rejects unknown and unavailable variables", () => {
    expect(validateTemplateVariables({ value: "{secret}" })).toEqual(["secret"]);
    expect(() => renderTemplate({ value: "{secret}" }, {})).toThrow("unsupported variable");
    expect(() => renderTemplate({ value: "{size}" }, {})).toThrow("unavailable");
  });

  test("rejects an array embedded inside a string", () => {
    expect(() =>
      renderTemplate({ value: "images={imageDataUris}" }, { imageDataUris: ["a"] }),
    ).toThrow("cannot be embedded");
  });
});

describe("response path extraction", () => {
  const response = {
    output: {
      choices: [
        { images: [{ url: "https://one" }, { url: "https://two" }] },
        { images: [{ url: "https://three" }] },
      ],
    },
  };

  test("extracts nested arrays with wildcard", () => {
    expect(extractPath(response, "output.choices.*.images.*.url")).toEqual([
      "https://one",
      "https://two",
      "https://three",
    ]);
  });

  test("supports indexes and a leading dollar root", () => {
    expect(extractFirst(response, "$.output.choices[1].images[0].url")).toBe("https://three");
    expect(parsePath("data[0].b64_json")).toEqual(["data", 0, "b64_json"]);
  });

  test("returns an empty list for missing data and rejects expression syntax", () => {
    expect(extractPath(response, "output.missing.*.url")).toEqual([]);
    expect(() => parsePath("$..images[?(@.url)]")).toThrow("unsupported");
  });
});
