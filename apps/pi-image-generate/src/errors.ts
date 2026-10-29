export class ImageGenerateError extends Error {
  readonly category: string;

  constructor(message: string, category: string) {
    super(message);
    this.name = "ImageGenerateError";
    this.category = category.replace(/[\r\n].*/s, "") || "image-generation-error";
  }
}

export function userErrorMessage(error: unknown): string {
  return error instanceof ImageGenerateError
    ? error.message
    : "Image generation failed unexpectedly. Retry once; if it persists, report a plugin issue.";
}

export function logErrorCategory(error: unknown): string {
  return error instanceof ImageGenerateError ? error.category : "unexpected image generation error";
}

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "<url>";
  }
}
