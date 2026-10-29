import { ImageGenerateError } from "./errors.ts";
import type { CredentialReference, HeaderReference } from "./types.ts";

export interface PiCredentialResolver {
  getApiKeyForProvider(providerId: string): Promise<string | undefined>;
}

export async function resolveCredential(
  reference: CredentialReference | undefined,
  providerId: string,
  modelRegistry: PiCredentialResolver,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<string | undefined> {
  if (!reference) return undefined;
  if (reference.source === "pi-auth") {
    try {
      return nonEmpty(await modelRegistry.getApiKeyForProvider(providerId));
    } catch {
      throw new ImageGenerateError(
        `Pi authentication for provider "${providerId}" could not be resolved. Re-authenticate or choose another credential source.`,
        "pi-auth-resolution-failed",
      );
    }
  }
  if (reference.source === "env") {
    const value = nonEmpty((options.env ?? process.env)[reference.value]);
    if (!value) {
      throw new ImageGenerateError(
        `Provider "${providerId}" is missing the configured environment credential. Set the environment variable selected in /image-generate settings.`,
        "environment-credential-missing",
      );
    }
    return value;
  }
  return nonEmpty(reference.value);
}

export async function resolveHeaderReferences(
  headers: HeaderReference[] | undefined,
  providerId: string,
  modelRegistry: PiCredentialResolver,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  for (const header of headers ?? []) {
    const value = await resolveCredential(header.value, providerId, modelRegistry, options);
    if (value) resolved[header.name] = value;
  }
  return resolved;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
