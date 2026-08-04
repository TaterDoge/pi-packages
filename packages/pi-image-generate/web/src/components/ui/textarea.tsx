import type * as React from "react";
import { cn } from "../../lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 font-mono text-xs leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10",
        className,
      )}
      {...props}
    />
  );
}
