import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";
import { cn } from "../../lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400",
        className,
      )}
      {...props}
    />
  );
}
