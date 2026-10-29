/**
 * Minimal SGR → React span converter.
 *
 * The server renders real terminal output (theme truecolor + raw 16-colour ANSI from
 * status styles), so the browser only has to translate SGR attributes into CSS.
 */

export type Segment = {
  text: string;
  bold: boolean;
  dim: boolean;
  /** CSS color for the foreground, or undefined to inherit. */
  color?: string;
};

const ANSI_NAMES = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"] as const;

function slotColor(slot: number): string {
  const bright = slot >= 8;
  const name = ANSI_NAMES[slot % 8];
  return `var(--ansi-${bright ? "bright-" : ""}${name})`;
}

/** Parse a single SGR body ("1;36" / "0" / "38;2;1;2;3") and apply it to the state. */
function applySgr(state: Omit<Segment, "text">, body: string): Omit<Segment, "text"> {
  const params =
    body === "" ? [0] : body.split(";").map((part) => (part === "" ? 0 : Number(part)));
  let next = { ...state };

  for (let index = 0; index < params.length; index += 1) {
    const code = params[index] ?? 0;
    if (code === 0) {
      next = { bold: false, dim: false };
      continue;
    }
    if (code === 1) {
      next.bold = true;
      continue;
    }
    if (code === 2) {
      next.dim = true;
      continue;
    }
    if (code === 22) {
      next.bold = false;
      next.dim = false;
      continue;
    }
    if (code === 39) {
      next.color = undefined;
      continue;
    }
    if (code >= 30 && code <= 37) {
      next.color = slotColor(code - 30);
      continue;
    }
    if (code >= 90 && code <= 97) {
      next.color = slotColor(code - 90 + 8);
      continue;
    }
    if (code === 38 && params[index + 1] === 2) {
      const [r, g, b] = [params[index + 2], params[index + 3], params[index + 4]];
      if (r !== undefined && g !== undefined && b !== undefined) {
        next.color = `rgb(${r} ${g} ${b})`;
      }
      index += 4;
    }
  }

  return next;
}

/**
 * U+202F is one cell in the terminal but about half a cell in every browser monospace, which
 * shifts everything after it and leaves the top-right corner short of the frame's column.
 */
const SUB_CELL_SPACES = /[\u2009\u202F]/g;

export function parseAnsi(input: string): Segment[] {
  const segments: Segment[] = [];
  let state: Omit<Segment, "text"> = { bold: false, dim: false };
  let buffer = "";
  let index = 0;
  const esc = String.fromCharCode(27);

  const flush = () => {
    if (buffer.length === 0) return;
    segments.push({ ...state, text: buffer.replace(SUB_CELL_SPACES, " ") });
    buffer = "";
  };

  while (index < input.length) {
    if (input[index] === esc && input[index + 1] === "[") {
      const end = input.indexOf("m", index + 2);
      if (end === -1) break;
      flush();
      state = applySgr(state, input.slice(index + 2, end));
      index = end + 1;
      continue;
    }
    buffer += input[index];
    index += 1;
  }
  flush();
  return segments;
}
