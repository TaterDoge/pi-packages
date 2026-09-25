import type { ConfigIssue } from "@/types";

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = (data.issues as ConfigIssue[] | undefined)
      ?.map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(issues || data.error || `Request failed (${response.status}).`);
  }
  return data as T;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
