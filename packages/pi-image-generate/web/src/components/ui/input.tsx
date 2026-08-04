import type * as React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10",
        className,
      )}
      {...props}
    />
  );
}
