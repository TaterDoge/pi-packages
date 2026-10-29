import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Card, CardContent } from "@taterdoge/ui/components/ui/card";
import { GripVerticalIcon } from "lucide-react";
import type { ComponentId } from "../../src/types.ts";
import { COMPONENT_ICONS } from "./icons";

type TrayProps = {
  disabled: ComponentId[];
  samples: Record<string, string>;
  onEnable: (id: ComponentId) => void;
};

export function Tray({ disabled, samples, onEnable }: TrayProps) {
  const { ref, isDropTarget } = useDroppable({ id: "tray" });
  return (
    <aside className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium text-sm">Turned off</h2>
        <p className="text-muted-foreground text-xs">
          Drag a module off the border to hide it, or drag one back to switch it on.
        </p>
      </div>
      <div
        ref={ref}
        className={`grid min-h-40 content-start gap-2 rounded-lg border border-dashed p-2 transition-colors sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] ${
          isDropTarget ? "border-primary bg-primary/10" : "border-border"
        }`}
      >
        {disabled.length === 0 ? (
          <p className="p-2 text-muted-foreground text-xs italic">Every module is on the border.</p>
        ) : (
          disabled.map((id) => (
            <TrayChip key={id} id={id} sample={samples[id] ?? ""} onEnable={() => onEnable(id)} />
          ))
        )}
      </div>
    </aside>
  );
}

function TrayChip({
  id,
  sample,
  onEnable,
}: {
  id: ComponentId;
  sample: string;
  onEnable: () => void;
}) {
  const { ref, isDragging } = useDraggable({ id, type: "component" });
  const Icon = COMPONENT_ICONS[id];
  return (
    <Card ref={ref} className={`cursor-grab select-none p-0 ${isDragging ? "opacity-40" : ""}`}>
      <CardContent className="flex items-center gap-1.5 px-2 py-1.5">
        <GripVerticalIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 text-muted-foreground leading-3">
            <Icon className="size-3 shrink-0" aria-hidden />
            <code className="font-mono text-[10px]">{id}</code>
          </span>
          <span className="max-w-48 truncate text-xs glyphs">{sample || "—"}</span>
        </div>
        <button
          type="button"
          className="ml-auto text-primary text-xs underline-offset-2 hover:underline"
          onClick={onEnable}
        >
          add
        </button>
      </CardContent>
    </Card>
  );
}
