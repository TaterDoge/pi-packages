import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as SelectPrimitive from "@kobalte/core/select";
import {
  Root,
  Section,
  type SelectContentProps as SelectPrimitiveContentProps,
  type SelectTriggerProps as SelectPrimitiveTriggerProps,
  type SelectValueProps as SelectPrimitiveValueProps,
  type SelectRootProps,
  type SelectSectionProps,
  Value,
} from "@kobalte/core/select";
import { Check, ChevronsUpDown } from "lucide-solid";
import type { ComponentProps, JSX, ValidComponent } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

// Zaidan's `z-select*` hooks are expanded into the utilities they resolve to,
// because the style layer that defines them is not part of the registry.
type SelectProps<O, OptGroup = never, T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  SelectRootProps<O, OptGroup, T>
> &
  Pick<ComponentProps<T>, "class" | "children">;

const Select = <O, OptGroup = never, T extends ValidComponent = "div">(
  props: SelectProps<O, OptGroup, T>,
) => {
  const mergedProps = mergeProps(
    {
      sameWidth: true,
      gutter: 4,
      placement: "bottom",
    } as const,
    props,
  );
  return <Root {...mergedProps} />;
};

type SelectGroupProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  SelectSectionProps<T>
> &
  Pick<ComponentProps<T>, "class">;

const SelectGroup = <T extends ValidComponent = "div">(props: SelectGroupProps<T>) => {
  const [local, others] = splitProps(props as SelectGroupProps, ["class"]);
  return <Section class={cn("p-1", local.class)} data-slot="select-group" {...others} />;
};

type SelectValueProps<Option, T extends ValidComponent = "span"> = PolymorphicProps<
  T,
  SelectPrimitiveValueProps<Option, T>
> &
  Pick<ComponentProps<T>, "class">;

const SelectValue = <Option, T extends ValidComponent = "span">(
  props: SelectValueProps<Option, T>,
) => {
  const [local, others] = splitProps(props as SelectValueProps<Option>, ["class"]);
  return (
    <Value
      class={cn("flex min-w-0 items-center gap-2 truncate", local.class)}
      data-slot="select-value"
      {...others}
    />
  );
};

type SelectTriggerProps<T extends ValidComponent = "button"> = PolymorphicProps<
  T,
  SelectPrimitiveTriggerProps<T>
> &
  Pick<ComponentProps<T>, "class" | "children"> & {
    size?: "sm" | "default";
  };

const SelectTrigger = <T extends ValidComponent = "button">(rawProps: SelectTriggerProps<T>) => {
  const props = mergeProps({ size: "default" }, rawProps);
  const [local, others] = splitProps(props as SelectTriggerProps, ["class", "children", "size"]);

  return (
    <SelectPrimitive.Trigger
      class={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm whitespace-nowrap text-foreground outline-none transition-[color,box-shadow] data-[size=default]:h-9 data-[size=sm]:h-8 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      data-size={local.size}
      data-slot="select-trigger"
      {...others}
    >
      {local.children}
      <SelectPrimitive.Icon as={ChevronsUpDown} class="pointer-events-none size-4 opacity-50" />
    </SelectPrimitive.Trigger>
  );
};

type SelectContentProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  SelectPrimitiveContentProps<T>
> &
  Pick<ComponentProps<T>, "class"> & {};

const SelectContent = <T extends ValidComponent = "div">(props: SelectContentProps<T>) => {
  const [local, others] = splitProps(props as SelectContentProps, ["class"]);
  let contentRef: HTMLElement | undefined;
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={(el) => (contentRef = el)}
        class={cn(
          "relative isolate z-50 max-h-80 min-w-32 origin-(--kb-select-content-transform-origin) overflow-hidden overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none",
          local.class,
        )}
        data-slot="select-content"
        {...others}
      >
        <SelectPrimitive.Listbox class="m-0 p-1" scrollRef={() => contentRef} />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
};

type SelectLabelProps<T extends ValidComponent = "span"> = SelectPrimitive.SelectLabelProps<T> & {
  class?: string | undefined;
};

const SelectLabel = <T extends ValidComponent = "span">(
  props: PolymorphicProps<T, SelectLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as SelectLabelProps, ["class"]);
  return (
    <SelectPrimitive.Label
      class={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", local.class)}
      data-slot="select-label"
      {...others}
    />
  );
};

type SelectItemProps<T extends ValidComponent = "li"> = SelectPrimitive.SelectItemProps<T> & {
  class?: string | undefined;
  children?: JSX.Element;
};

const SelectItem = <T extends ValidComponent = "li">(
  props: PolymorphicProps<T, SelectItemProps<T>>,
) => {
  const [local, others] = splitProps(props as SelectItemProps, ["class", "children"]);
  return (
    <SelectPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        local.class,
      )}
      data-slot="select-item"
      {...others}
    >
      <SelectPrimitive.ItemLabel class="flex-1 truncate">
        {local.children}
      </SelectPrimitive.ItemLabel>
      <SelectPrimitive.ItemIndicator
        as="span"
        class="absolute right-2 flex size-4 items-center justify-center"
      >
        <Check class="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
};

type SelectSeparatorProps<T extends ValidComponent = "hr"> = ComponentProps<T> & {
  class?: string | undefined;
};

const SelectSeparator = <T extends ValidComponent = "hr">(
  props: PolymorphicProps<T, SelectSeparatorProps<T>>,
) => {
  const [local, others] = splitProps(props as SelectSeparatorProps, ["class"]);
  return (
    <hr
      class={cn("pointer-events-none my-1 h-px border-0 bg-border", local.class)}
      data-slot="select-separator"
      {...others}
    />
  );
};

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
