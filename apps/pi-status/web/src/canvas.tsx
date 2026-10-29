import { Feedback, PreventSelection } from "@dnd-kit/dom";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Card, CardContent } from "@taterdoge/ui/components/ui/card";
import { GripVerticalIcon } from "lucide-react";
import { type ReactNode, useMemo, useRef } from "react";
import type { PreviewPayload } from "../../src/settings/protocol.ts";
import type { ComponentId, Zone } from "../../src/types.ts";
import { parseAnsi } from "./ansi";
import { COMPONENT_ICONS } from "./icons";
import { findZone, type Layout } from "./layout";

/**
 * Fixed demo width for the border preview. The real terminal truncates to its own width; matching
 * the browser window instead only bought pixel fidelity, at the cost of measuring fonts on resize.
 */
export const PREVIEW_COLUMNS = 120;

export type MoveHandler = (id: ComponentId, to: Zone | "tray", index?: number) => void;

type CanvasProps = {
  layout: Layout;
  preview: PreviewPayload | undefined;
  samples: Record<string, string>;
  onMove: MoveHandler;
};

/** dnd-kit needs a container droppable per zone; prefixing keeps it out of the component id space. */
const ZONE_PREFIX = "zone:";

export function zoneKey(zone: Zone): string {
  return `${ZONE_PREFIX}${zone}`;
}

function zoneOf(value: string): Zone | undefined {
  if (!value.startsWith(ZONE_PREFIX)) return undefined;
  return value.slice(ZONE_PREFIX.length) as Zone;
}

/**
 * The tray and the canvas are siblings, so the provider must wrap both: a droppable that is
 * outside `<DragDropProvider>` is never registered and can never be a drop target.
 */
export function LayoutProvider({
  layout,
  onMove,
  children,
}: {
  layout: Layout;
  onMove: MoveHandler;
  children: ReactNode;
}) {
  // dnd-kit can dispatch dragend more than once per gesture. Reset on dragstart so each
  // gesture applies exactly one move.
  const handled = useRef(false);
  return (
    <DragDropProvider
      // PreventSelection injects a global `* { user-select: none !important }` on the first
      // drag and never removes it, which makes every widget unselectable for the whole session.
      plugins={(plugins) => [
        ...plugins.filter((plugin) => plugin !== PreventSelection),
        // The drop animation outlives the React update that moves the chip into another zone,
        // which leaves the dragged node pinned as a grey ghost. Settle instantly instead.
        Feedback.configure({ dropAnimation: null }),
      ]}
      // The whole card is the drag handle now, so dnd-kit's default constraints apply: a press
      // starts the drag immediately and cancels the pointer event, which is what keeps the text
      // from being selected by the same gesture.
      onDragStart={() => {
        handled.current = false;
      }}
      onDragEnd={(event) => {
        if (handled.current) return;
        handled.current = true;
        if (event.canceled) return;
        const from = event.operation.source?.id;
        const to = event.operation.target?.id;
        if (from === undefined || to === undefined) return;
        const id = String(from);
        if (zoneOf(id) || id === "tray" || to === from) return;
        const target = String(to);
        const toZone = zoneOf(target);
        if (toZone) {
          onMove(id as ComponentId, toZone);
          return;
        }
        if (target === "tray") {
          onMove(id as ComponentId, "tray");
          return;
        }
        // Dropped onto another chip: take that chip's slot. `moveInLayout` strips the id first, so
        // it wants the index in the post-removal list — the target chip's own index, unchanged by
        // which direction the drop came from. Shifting it for forward moves lands a slot short and
        // makes an adjacent drop (the common swap) a no-op.
        const targetId = target as ComponentId;
        const targetZone = findZone(layout, targetId);
        if (!targetZone) return;
        onMove(id as ComponentId, targetZone, layout[targetZone].indexOf(targetId));
      }}
    >
      {children}
    </DragDropProvider>
  );
}

export function Canvas({ layout, preview, samples, onMove }: CanvasProps) {
  // The corners are painted with the theme's border colour, so the side lines take theirs from the
  // top row's first run instead of guessing a page token.
  const corner = useMemo(
    () => (preview?.top ? parseAnsi(preview.top)[0] : undefined),
    [preview?.top],
  );
  const width = PREVIEW_COLUMNS;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xs">
      {/* `ch` is only meaningful with the border row's font and size, so the frame owns both. */}
      <div className="ansi text-xs" style={{ width: `${width}ch` }}>
        <BorderRow text={preview?.top} />
        <div className="flex items-stretch">
          <FrameSide color={corner?.color} dim={corner?.dim} />
          <div className="min-w-0 flex-1 px-2">
            <ZoneGrid zones={["top-left", "top-right"]} {...{ layout, samples, onMove }} />
            <div className="my-2 rounded-md border border-dashed bg-muted/40 px-3 py-6 text-center text-muted-foreground text-xs">
              editor
            </div>
            <ZoneGrid zones={["bottom-left", "bottom-right"]} {...{ layout, samples, onMove }} />
          </div>
          <FrameSide color={corner?.color} dim={corner?.dim} />
        </div>
        <BorderRow text={preview?.bottom} />
      </div>
    </div>
  );
}

function ZoneGrid({
  zones,
  layout,
  samples,
  onMove,
}: {
  zones: [Zone, Zone];
  layout: Layout;
  samples: Record<string, string>;
  onMove: MoveHandler;
}) {
  return (
    <div className="my-2 grid grid-cols-2 gap-3">
      {zones.map((zone) => (
        <ZoneDrop key={zone} zone={zone} ids={layout[zone]} samples={samples} onMove={onMove} />
      ))}
    </div>
  );
}

/**
 * The side columns are glyphs, not CSS borders: only the same glyph paints the same stroke width,
 * colour and pixel snapping as the corner stems, so ╭ │ ╰ reads as one continuous frame. Glyphs are
 * stacked tighter than their ink height, which is what closes the seam between two of them.
 */
function FrameSide({ color, dim }: { color: string | undefined; dim: boolean | undefined }) {
  return (
    <div aria-hidden className="relative w-[1ch] shrink-0">
      <div
        className="-top-0.5 -bottom-0.5 absolute inset-x-0 overflow-hidden text-center"
        style={{
          color,
          lineHeight: "1.5em",
          opacity: dim ? 0.6 : undefined,
          // Taller than any realistic frame; `overflow-hidden` clips the rest per column height.
          whiteSpace: "pre",
        }}
      >
        {"│\n".repeat(120)}
      </div>
    </div>
  );
}

function BorderRow({ text }: { text: string | undefined }) {
  const segments = useMemo(() => (text ? parseAnsi(text) : []), [text]);
  return (
    // `h-5` holds the row's height before the preview arrives; an empty div would collapse and the
    // frame would jump when it fills in.
    <div
      className="ansi h-5 overflow-hidden text-xs leading-5"
      role="img"
      aria-label="Border preview"
    >
      {segments.map((segment, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ANSI runs are positional, not identity.
          key={index}
          style={{
            color: segment.color,
            fontWeight: segment.bold ? 700 : undefined,
            opacity: segment.dim ? 0.6 : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function ZoneDrop({
  zone,
  ids,
  samples,
  onMove,
}: {
  zone: Zone;
  ids: ComponentId[];
  samples: Record<string, string>;
  onMove: MoveHandler;
}) {
  // The container stays droppable so an empty zone can still receive a drop.
  const { ref, isDropTarget } = useDroppable({ id: zoneKey(zone) });
  const isHovered = isDropTarget;
  return (
    <div
      ref={ref}
      data-zone={zone}
      className={`min-h-16 rounded-md border p-2 transition-colors ${
        isHovered
          ? "border-primary bg-primary/10 ring-2 ring-primary/40"
          : "border-border bg-background"
      }`}
    >
      <p className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
        {zone}
      </p>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id, index) => (
          <ZoneChip
            key={id}
            id={id}
            zone={zone}
            index={index}
            sample={samples[id] ?? ""}
            onMove={onMove}
          />
        ))}
        {ids.length === 0 ? (
          <li className="text-muted-foreground text-xs italic">drop here</li>
        ) : null}
      </ul>
    </div>
  );
}

function ZoneChip({
  id,
  zone,
  index,
  sample,
  onMove,
}: {
  id: ComponentId;
  zone: Zone;
  index: number;
  sample: string;
  onMove: MoveHandler;
}) {
  const { ref, isDragging, isDropTarget } = useSortable({
    id,
    index,
    group: zone,
    type: "component",
    // OptimisticSortingPlugin moves the dragged node into the target <ul> itself. React owns
    // these lists, so that leaves an orphan card behind: drop it and let the state update move
    // the chip instead.
    plugins: (plugins) => plugins.filter((plugin) => plugin !== OptimisticSortingPlugin),
  });
  const Icon = COMPONENT_ICONS[id];
  return (
    <li>
      <Card
        ref={ref}
        tabIndex={0}
        className={`w-fit cursor-grab select-none p-0 outline-none transition-shadow focus-visible:ring-2 ${
          isDragging ? "opacity-30" : ""
        } ${isDropTarget && !isDragging ? "ring-2 ring-primary" : ""}`}
        aria-label={`${id} in ${zone}`}
        onKeyDown={(event) => {
          // Pointer drag is the primary path; this keeps reordering reachable by keyboard.
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            onMove(id, zone, Math.max(0, index - 1));
          } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            onMove(id, zone, index + 1);
          }
        }}
      >
        <CardContent className="flex items-center gap-1.5 px-2 py-1">
          <GripVerticalIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-muted-foreground leading-3">
              <Icon className="size-3 shrink-0" aria-hidden />
              <code className="font-mono text-[10px]">{id}</code>
            </span>
            <span className="max-w-48 truncate text-xs glyphs">{sample || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
