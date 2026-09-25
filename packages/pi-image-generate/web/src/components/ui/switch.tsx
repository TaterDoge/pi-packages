import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { Control, Input, Root, type SwitchRootProps, Thumb } from "@kobalte/core/switch";
import { type ComponentProps, splitProps, type ValidComponent } from "solid-js";

import { cn } from "@/lib/utils";

type SwitchProps<T extends ValidComponent = "div"> = PolymorphicProps<T, SwitchRootProps<T>> &
  Pick<ComponentProps<T>, "class">;

const Switch = <T extends ValidComponent = "div">(props: SwitchProps<T>) => {
  const [local, others] = splitProps(props as SwitchProps, ["checked", "class", "id"]);
  return (
    <Root
      class={cn(
        "group/switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input outline-none transition-colors data-checked:bg-primary data-disabled:opacity-50 focus-within:ring-[3px] focus-within:ring-ring/50",
        local.class,
      )}
      {...others}
    >
      <Input id={local.id} />
      <Control class="flex h-5 w-9 cursor-pointer items-center rounded-full">
        <Thumb
          class={cn(
            "block size-4 rounded-full bg-background shadow-sm transition-transform",
            local.checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </Control>
    </Root>
  );
};

export { Switch, type SwitchProps };
