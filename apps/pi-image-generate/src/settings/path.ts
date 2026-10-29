import type { SettingsValue } from "./types.ts";

/**
 * Dotted paths: `a.b`, `a.*.c`. `*` matches any key or index and is only meaningful
 * in descriptor patterns (mask/restore); get/set walk concrete segments only.
 */

type Segment = string | number;

export function splitPath(path: string): string[] {
  return path.split(".").filter((segment) => segment.length > 0);
}

export function getPath(root: SettingsValue, path: string): SettingsValue {
  let current: SettingsValue = root;
  for (const segment of splitPath(path)) {
    if (current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    current = current[segment];
  }
  return current;
}

/** Returns a new tree with `path` replaced. Missing intermediate objects are created. */
export function setPath(root: SettingsValue, path: string, value: SettingsValue): SettingsValue {
  const segments = splitPath(path);
  if (segments.length === 0) return value;
  return write(root, segments, value);
}

function write(
  node: SettingsValue,
  [head, ...rest]: string[],
  value: SettingsValue,
): SettingsValue {
  if (Array.isArray(node)) {
    const index = Number(head);
    if (!Number.isInteger(index)) return node;
    const next = [...node];
    next[index] = rest.length === 0 ? value : write(next[index], rest, value);
    return next;
  }
  const container: Record<string, SettingsValue> =
    node !== null && typeof node === "object" ? { ...node } : {};
  container[head] = rest.length === 0 ? value : write(container[head], rest, value);
  return container;
}

/** Replaces every value matching `patterns` with `replacement`, keeping the tree shape. */
export function maskPaths(
  root: SettingsValue,
  patterns: string[],
  replacement: string,
): SettingsValue {
  return mapMatches(root, [], patterns.map(splitPath), () => replacement);
}

/**
 * Restores values that came back from the browser still masked: an untouched secret
 * arrives as the placeholder, so the persisted value has to be put back before
 * validation or save.
 */
export function restoreMasked(
  draft: SettingsValue,
  original: SettingsValue,
  patterns: string[],
  replacement: string,
): SettingsValue {
  return mapMatches(draft, [], patterns.map(splitPath), (value, path) => {
    const previous = readRaw(original, path);
    return value === replacement ? previous : value;
  });
}

function mapMatches(
  node: SettingsValue,
  path: Segment[],
  patterns: string[][],
  replace: (value: SettingsValue, path: Segment[]) => SettingsValue,
): SettingsValue {
  if (patterns.some((pattern) => matches(pattern, path))) return replace(node, path);
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    return node.map((item, index) => mapMatches(item, [...path, index], patterns, replace));
  }
  const output: Record<string, SettingsValue> = {};
  for (const [key, value] of Object.entries(node)) {
    output[key] = mapMatches(value, [...path, key], patterns, replace);
  }
  return output;
}

function matches(pattern: string[], path: Segment[]): boolean {
  if (pattern.length !== path.length) return false;
  return pattern.every((segment, index) => segment === "*" || segment === String(path[index]));
}

function readRaw(root: SettingsValue, path: Segment[]): SettingsValue {
  let current: SettingsValue = root;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = Array.isArray(current) ? current[Number(segment)] : current[String(segment)];
  }
  return current;
}

export function uniqueKey(existing: Record<string, unknown>, base: string): string {
  if (!(base in existing)) return base;
  const stem = base.replace(/\d+$/, "");
  let index = 1;
  while (`${stem}${index}` in existing) index += 1;
  return `${stem}${index}`;
}
