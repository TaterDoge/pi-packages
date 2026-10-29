import {
  ActivityIcon,
  ArrowUpDownIcon,
  BoxesIcon,
  BrainIcon,
  CircleDollarSignIcon,
  ClockIcon,
  CpuIcon,
  FolderIcon,
  GaugeIcon,
  GitBranchIcon,
  type LucideIcon,
  RecycleIcon,
  RepeatIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import type { ComponentId } from "../../src/types.ts";

/**
 * One chip glyph per module. The sample text below the chip label is a terminal render, so its
 * leading Nerd Font symbol disappears in a browser without that font — this icon is the part a
 * user can always see.
 */
export const COMPONENT_ICONS: Record<ComponentId, LucideIcon> = {
  status: ActivityIcon,
  cwd: FolderIcon,
  git: GitBranchIcon,
  runtime: BoxesIcon,
  cost: CircleDollarSignIcon,
  model: CpuIcon,
  thinking: BrainIcon,
  context: GaugeIcon,
  tokens: ArrowUpDownIcon,
  turn: RepeatIcon,
  current_tool: WrenchIcon,
  tps: ZapIcon,
  cache: RecycleIcon,
  elapsed: ClockIcon,
};
