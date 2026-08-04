import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";
import { cn } from "../../lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-11 rounded-full bg-slate-700 outline-none transition-colors data-[state=checked]:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
