import { ImageGenerateError } from "../errors.ts";
import type { JsonValue } from "../types.ts";

export type TemplateValue = JsonValue | undefined;
export type TemplateVariables = Record<string, TemplateValue>;

export const TEMPLATE_VARIABLES = [
  "baseUrl",
  "model",
  "prompt",
  "n",
  "size",
  "quality",
  "imageDataUris",
  "imageUrls",
  "taskId",
] as const;

const ALLOWED_VARIABLES = new Set<string>(TEMPLATE_VARIABLES);
const FULL_TEMPLATE = /^\{([A-Za-z][A-Za-z0-9]*)\}$/;
const INLINE_TEMPLATE = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function renderTemplate<T extends JsonValue>(template: T, variables: TemplateVariables): T {
  return renderValue(template, variables, "$", new WeakSet()) as T;
}

export function renderTemplateString(
  template: string,
  variables: TemplateVariables,
): TemplateValue {
  const full = FULL_TEMPLATE.exec(template);
  if (full) {
    const value = variable(full[1], variables);
    if (value === undefined) {
      throw new ImageGenerateError(
        `Template variable "${full[1]}" is unavailable for this request.`,
        "template-variable-unavailable",
      );
    }
    return structuredClone(value);
  }
  return template.replace(INLINE_TEMPLATE, (_match, name: string) => {
    const value = variable(name, variables);
    if (value === undefined) {
      throw new ImageGenerateError(
        `Template variable "${name}" is unavailable for this request.`,
        "template-variable-unavailable",
      );
    }
    if (typeof value === "object") {
      throw new ImageGenerateError(
        `Template variable "${name}" cannot be embedded inside a string.`,
        "template-variable-type-invalid",
      );
    }
    return String(value);
  });
}

export function validateTemplateVariables(template: JsonValue): string[] {
  const invalid = new Set<string>();
  walkStrings(template, (value) => {
    for (const match of value.matchAll(INLINE_TEMPLATE)) {
      const name = match[1];
      if (name && !ALLOWED_VARIABLES.has(name)) invalid.add(name);
    }
    const braces = value.replace(INLINE_TEMPLATE, "");
    if (/[{}]/.test(braces)) invalid.add("<malformed>");
  });
  return [...invalid];
}

export function extractPath(root: unknown, path: string): unknown[] {
  const tokens = parsePath(path);
  let current: unknown[] = [root];
  for (const token of tokens) {
    const next: unknown[] = [];
    for (const value of current) {
      if (token === "*") {
        if (Array.isArray(value)) next.push(...value);
        else if (isRecord(value)) next.push(...Object.values(value));
        continue;
      }
      if (typeof token === "number") {
        if (Array.isArray(value) && token < value.length) next.push(value[token]);
        continue;
      }
      if (isRecord(value) && Object.hasOwn(value, token)) next.push(value[token]);
    }
    current = next;
  }
  return current;
}

export function extractFirst(root: unknown, path: string): unknown {
  return extractPath(root, path)[0];
}

export function parsePath(path: string): Array<string | number> {
  const trimmed = path.trim();
  if (!trimmed) throw new ImageGenerateError("Response path is empty.", "response-path-empty");
  if (
    /[()?@]/.test(trimmed) ||
    trimmed.includes("..") ||
    (trimmed.includes("$") && !trimmed.startsWith("$"))
  ) {
    throw new ImageGenerateError(
      "Response path uses unsupported expression syntax.",
      "response-path-unsupported",
    );
  }
  const normalized = trimmed.replace(/^\$\.?/, "").replace(/\[(\d+|\*)\]/g, ".$1");
  if (
    !normalized ||
    normalized.startsWith(".") ||
    normalized.endsWith(".") ||
    /\[|\]/.test(normalized)
  ) {
    throw new ImageGenerateError("Response path is malformed.", "response-path-malformed");
  }
  return normalized.split(".").map((part) => {
    if (part === "*") return part;
    if (/^(0|[1-9]\d*)$/.test(part)) return Number(part);
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(part)) {
      throw new ImageGenerateError("Response path is malformed.", "response-path-malformed");
    }
    return part;
  });
}

function renderValue(
  value: JsonValue,
  variables: TemplateVariables,
  at: string,
  seen: WeakSet<object>,
): JsonValue {
  if (typeof value === "string") return renderTemplateString(value, variables) as JsonValue;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (seen.has(value)) {
    throw new ImageGenerateError(`Template at ${at} is circular.`, "template-circular");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const output: JsonValue[] = [];
    for (const [index, item] of value.entries()) {
      const rendered = renderValue(item, variables, `${at}.${index}`, seen);
      output.push(rendered);
    }
    seen.delete(value);
    return output;
  }
  const output: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = renderValue(item, variables, `${at}.${key}`, seen);
  }
  seen.delete(value);
  return output;
}

function variable(name: string | undefined, variables: TemplateVariables): TemplateValue {
  if (!name || !ALLOWED_VARIABLES.has(name)) {
    throw new ImageGenerateError(
      `Template contains unsupported variable "${name ?? ""}".`,
      "template-variable-unsupported",
    );
  }
  return variables[name];
}

function walkStrings(value: JsonValue, visit: (value: string) => void): void {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const item of value) walkStrings(item, visit);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
