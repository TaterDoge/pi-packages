import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { ALL_COMPONENT_IDS, DEFAULT_CONFIG, ZONE_IDS } from "./constants.ts";
import type { ComponentConfig, ComponentId, PiStatusConfig, Zone } from "./types.ts";

function getPiStatusPaths(): { global: string; project: string } {
  return {
    global: path.join(homedir(), ".pi", "agent", "pi-status.json"),
    project: path.join(process.cwd(), ".pi", "pi-status.json"),
  };
}

function getLegacySettingsPaths(): { global: string; project: string } {
  return {
    global: path.join(homedir(), ".pi", "agent", "settings.json"),
    project: path.join(process.cwd(), ".pi", "settings.json"),
  };
}

function loadJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getDefaultPiStatusConfig(): PiStatusConfig {
  return structuredClone(DEFAULT_CONFIG);
}

export function isZoneId(value: unknown): value is Zone {
  return typeof value === "string" && ZONE_IDS.includes(value as Zone);
}

export function isComponentId(value: unknown): value is ComponentId {
  return typeof value === "string" && ALL_COMPONENT_IDS.includes(value as ComponentId);
}

export function validatePiStatusConfig(raw: Record<string, unknown>): PiStatusConfig | null {
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const separator = typeof raw.separator === "string" ? raw.separator : DEFAULT_CONFIG.separator;
  const rawComponents = Array.isArray(raw.components) ? raw.components : DEFAULT_CONFIG.components;
  const components: ComponentConfig[] = [];
  const seen = new Set<ComponentId>();

  for (const item of rawComponents) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const component = item as Record<string, unknown>;
    if (!isComponentId(component.id) || seen.has(component.id)) continue;
    seen.add(component.id);
    components.push({
      id: component.id,
      enabled: component.enabled !== false,
      zone: isZoneId(component.zone) ? component.zone : "top-left",
    });
  }

  for (const component of DEFAULT_CONFIG.components) {
    if (!seen.has(component.id)) components.push({ ...component });
  }

  return { separator, components };
}

export function migrateLegacyPiStatusConfig(): boolean {
  const { global: legacyGlobal, project: legacyProject } = getLegacySettingsPaths();
  const { global: newGlobal, project: newProject } = getPiStatusPaths();

  if (existsSync(newProject) || existsSync(newGlobal)) return false;

  const legacyPath = existsSync(legacyProject) ? legacyProject : legacyGlobal;
  const legacyData = loadJsonSafe(legacyPath);
  if (!legacyData) return false;

  const piStatusRaw = legacyData.piStatus;
  if (!piStatusRaw || typeof piStatusRaw !== "object" || Array.isArray(piStatusRaw)) return false;

  const config = validatePiStatusConfig(piStatusRaw as Record<string, unknown>);
  if (!config) return false;

  const targetPath = legacyPath === legacyProject ? newProject : newGlobal;
  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return true;
}

export function readPiStatusConfig(): PiStatusConfig {
  const { global, project } = getPiStatusPaths();
  const projectData = loadJsonSafe(project);
  if (projectData) return validatePiStatusConfig(projectData) ?? getDefaultPiStatusConfig();

  const globalData = loadJsonSafe(global);
  if (globalData) return validatePiStatusConfig(globalData) ?? getDefaultPiStatusConfig();

  return getDefaultPiStatusConfig();
}

export function writePiStatusConfig(
  config: PiStatusConfig,
  scope: "auto" | "global" | "project" = "auto",
): void {
  const { global, project } = getPiStatusPaths();
  const targetPath =
    scope === "project"
      ? project
      : scope === "global"
        ? global
        : existsSync(project)
          ? project
          : global;

  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function isComponentEnabled(config: PiStatusConfig, id: ComponentId): boolean {
  return config.components.some((component) => component.id === id && component.enabled);
}
