import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitStatusSummary } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

const execFileAsync = promisify(execFile);

/** `--branch` adds the branch/ahead-behind headers; `--show-stash` adds one stash header. */
const STATUS_ARGS = ["--no-optional-locks", "status", "--porcelain=2", "--branch"];

export function renderGitComponent({ state }: ComponentRenderInput): string {
  if (!state.branch) return "";
  const allStatus = [
    state.conflicted > 0 ? "=" : "",
    state.stashed ? "$" : "",
    state.deleted > 0 ? "✘" : "",
    state.renamed > 0 ? "»" : "",
    state.modified > 0 ? "!" : "",
    state.typechanged > 0 ? "T" : "",
    state.staged > 0 ? "+" : "",
    state.untracked > 0 ? "?" : "",
  ].join("");
  const aheadBehind =
    state.ahead > 0 && state.behind > 0 ? "⇕" : state.ahead > 0 ? "↑" : state.behind > 0 ? "↓" : "";
  const statusBlock = allStatus || aheadBehind ? ` [${allStatus}${aheadBehind}]` : "";
  return ` ${state.branch}${statusBlock}`;
}

export function emptyGitStatus(): GitStatusSummary {
  return {
    branch: undefined,
    ahead: 0,
    behind: 0,
    conflicted: 0,
    untracked: 0,
    stashed: false,
    modified: 0,
    staged: 0,
    renamed: 0,
    deleted: 0,
    typechanged: 0,
  };
}

export function parseGitStatusPorcelain(stdoutText: string): GitStatusSummary {
  const status = emptyGitStatus();

  for (const line of stdoutText.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      const branch = line.slice("# branch.head ".length).trim();
      status.branch = branch && branch !== "(detached)" ? branch : undefined;
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+)\s+-(\d+)/);
      if (match) {
        status.ahead = Number(match[1] ?? 0);
        status.behind = Number(match[2] ?? 0);
      }
      continue;
    }
    if (line.startsWith("# stash ")) {
      status.stashed = Number(line.slice("# stash ".length).trim()) > 0;
      continue;
    }
    if (line.startsWith("#")) continue;

    if (line.startsWith("? ")) {
      status.untracked += 1;
      continue;
    }
    if (line.startsWith("u ")) {
      status.conflicted += 1;
      continue;
    }
    if (!(line.startsWith("1 ") || line.startsWith("2 "))) continue;

    const xy = line.split(" ")[1] ?? "..";
    const x = xy[0] ?? ".";
    const y = xy[1] ?? ".";

    if (x === "R") status.renamed += 1;
    else if (x === "D") status.deleted += 1;
    else if (x === "T") status.typechanged += 1;
    else if (x !== "." && x !== " ") status.staged += 1;

    if (y === "M") status.modified += 1;
    else if (y === "D") status.deleted += 1;
    else if (y === "T") status.typechanged += 1;
  }

  return status;
}

async function gitStatusStdout(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, timeout: 3000 });
  return typeof stdout === "string" ? stdout : String(stdout);
}

export async function readGitStatus(cwd: string): Promise<GitStatusSummary> {
  try {
    // --show-stash folds the stash probe into this call, so a poll costs one git process.
    try {
      return parseGitStatusPorcelain(await gitStatusStdout(cwd, [...STATUS_ARGS, "--show-stash"]));
    } catch {
      // git < 2.16 rejects --show-stash; lose the stash marker rather than the whole status.
      return parseGitStatusPorcelain(await gitStatusStdout(cwd, STATUS_ARGS));
    }
  } catch {
    return emptyGitStatus();
  }
}
