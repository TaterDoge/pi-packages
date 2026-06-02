import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { RuntimeInfo } from "../types.ts";
import type { ComponentRenderInput } from "./type.ts";

const execFileAsync = promisify(execFile);

export function renderRuntimeComponent({ state }: ComponentRenderInput): string {
  return state.runtime
    ? `via ${state.runtime.symbol}${state.runtime.version ? ` ${state.runtime.version}` : ""}`
    : "";
}

async function runVersion(command: string, args: readonly string[] = [], cwd?: string) {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], { cwd, timeout: 2500 });
    return `${typeof stdout === "string" ? stdout : String(stdout)}\n${typeof stderr === "string" ? stderr : String(stderr)}`.trim();
  } catch {
    return undefined;
  }
}

function prefixVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.startsWith("v") ? version : `v${version}`;
}

function extractVersion(output: string | undefined, pattern?: RegExp): string | undefined {
  if (!output) return undefined;
  const match = output.match(
    pattern ?? /(?:version\s*)?v?([0-9]+(?:\.[0-9A-Za-z][0-9A-Za-z.+_-]*)*)/i,
  );
  return prefixVersion(match?.[1]);
}

export function hasRootMarker(cwd: string, marker: string): boolean {
  if (!marker.startsWith("*.")) return existsSync(path.join(cwd, marker));

  const suffix = marker.slice(1);
  try {
    return readdirSync(cwd).some((entry) => entry.endsWith(suffix));
  } catch {
    return false;
  }
}

export async function readRuntimeInfo(cwd: string): Promise<RuntimeInfo | undefined> {
  const checks: Array<{
    files: string[];
    runtime: Omit<RuntimeInfo, "version">;
    version: () => Promise<string | undefined>;
  }> = [
    {
      files: ["bun.lock", "bun.lockb"],
      runtime: { name: "bun", symbol: "", style: "bold red" },
      version: async () => prefixVersion(await runVersion("bun", ["--version"], cwd)),
    },
    {
      files: ["package.json", ".node-version", ".nvmrc"],
      runtime: { name: "nodejs", symbol: "", style: "bold green" },
      version: async () => prefixVersion(await runVersion("node", ["--version"], cwd)),
    },
    {
      files: ["deno.json", "deno.jsonc", "deno.lock"],
      runtime: { name: "deno", symbol: "", style: "green bold" },
      version: async () => extractVersion(await runVersion("deno", ["--version"], cwd)),
    },
    {
      files: ["go.mod"],
      runtime: { name: "golang", symbol: "", style: "bold cyan" },
      version: async () =>
        extractVersion(await runVersion("go", ["version"], cwd), /go version go([^\s]+)/i),
    },
    {
      files: ["Cargo.toml"],
      runtime: { name: "rust", symbol: "󱘗", style: "bold red" },
      version: async () =>
        extractVersion(await runVersion("rustc", ["--version"], cwd), /rustc\s+([^\s]+)/i),
    },
    {
      files: ["pyproject.toml", "requirements.txt", "Pipfile", ".python-version"],
      runtime: { name: "python", symbol: "", style: "yellow bold" },
      version: async () => extractVersion(await runVersion("python3", ["--version"], cwd)),
    },
    {
      files: ["Makefile"],
      runtime: { name: "c", symbol: "", style: "bold cyan" },
      version: async () => extractVersion(await runVersion("gcc", ["--version"], cwd)),
    },
    {
      files: ["CMakeLists.txt"],
      runtime: { name: "cpp", symbol: "", style: "bold blue" },
      version: async () => extractVersion(await runVersion("g++", ["--version"], cwd)),
    },
    {
      files: ["pom.xml", "build.gradle", "build.gradle.kts"],
      runtime: { name: "java", symbol: "", style: "bold red" },
      version: async () => extractVersion(await runVersion("java", ["--version"], cwd)),
    },
    {
      files: ["Gemfile", ".ruby-version"],
      runtime: { name: "ruby", symbol: "", style: "bold red" },
      version: async () => extractVersion(await runVersion("ruby", ["--version"], cwd)),
    },
    {
      files: ["composer.json"],
      runtime: { name: "php", symbol: "", style: "bold magenta" },
      version: async () => extractVersion(await runVersion("php", ["--version"], cwd)),
    },
    {
      files: ["Package.swift"],
      runtime: { name: "swift", symbol: "", style: "bold orange" },
      version: async () => extractVersion(await runVersion("swift", ["--version"], cwd)),
    },
    {
      files: ["*.lua"],
      runtime: { name: "lua", symbol: "", style: "bold blue" },
      version: async () => extractVersion(await runVersion("lua", ["-v"], cwd)),
    },
    {
      files: ["build.zig"],
      runtime: { name: "zig", symbol: "", style: "bold yellow" },
      version: async () => extractVersion(await runVersion("zig", ["version"], cwd)),
    },
    {
      files: ["pubspec.yaml"],
      runtime: { name: "dart", symbol: "", style: "bold blue" },
      version: async () => extractVersion(await runVersion("dart", ["--version"], cwd)),
    },
    {
      files: ["*.kt", "*.kts"],
      runtime: { name: "kotlin", symbol: "", style: "bold magenta" },
      version: async () => extractVersion(await runVersion("kotlin", ["--version"], cwd)),
    },
    {
      files: ["*.sol"],
      runtime: { name: "solidity", symbol: "", style: "bold blue" },
      version: async () => extractVersion(await runVersion("solc", ["--version"], cwd)),
    },
  ];

  for (const check of checks) {
    if (!check.files.some((file) => hasRootMarker(cwd, file))) continue;
    return { ...check.runtime, version: await check.version() };
  }
  return undefined;
}
