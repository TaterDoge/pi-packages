import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Content,
  List,
  Root,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsRootProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  Trigger,
} from "@kobalte/core/tabs";
import { type ComponentProps, splitProps, type ValidComponent } from "solid-js";

import { cn } from "@/lib/utils";

// The `z-tabs*` hooks are expanded into utilities because Zaidan's style layer
// is not published alongside the registry items.
type TabsProps<T extends ValidComponent = "div"> = PolymorphicProps<T, TabsRootProps<T>> &
  Pick<ComponentProps<T>, "class" | "children">;

const Tabs = <T extends ValidComponent = "div">(props: TabsProps<T>) => {
  const [local, others] = splitProps(props as TabsProps, ["class"]);
  return <Root class={cn("flex flex-col gap-5", local.class)} {...others} />;
};

type TabsListProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  TabsListPrimitiveProps<T>
> &
  Pick<ComponentProps<T>, "class" | "children">;

const TabsList = <T extends ValidComponent = "div">(props: TabsListProps<T>) => {
  const [local, others] = splitProps(props as TabsListProps, ["class"]);
  return (
    <List
      class={cn(
        "inline-flex w-fit items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        local.class,
      )}
      {...others}
    />
  );
};

type TabTriggerProps<T extends ValidComponent = "button"> = PolymorphicProps<
  T,
  TabsTriggerPrimitiveProps<T>
> &
  Pick<ComponentProps<T>, "class" | "children">;

const TabsTrigger = <T extends ValidComponent = "button">(props: TabTriggerProps<T>) => {
  const [local, others] = splitProps(props as TabTriggerProps, ["class"]);
  return (
    <Trigger
      class={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
        local.class,
      )}
      {...others}
    />
  );
};

type TabsContentProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  TabsContentPrimitiveProps<T>
> &
  Pick<ComponentProps<T>, "class" | "children">;

const TabsContent = <T extends ValidComponent = "div">(props: TabsContentProps<T>) => {
  const [local, others] = splitProps(props as TabsContentProps, ["class"]);
  return <Content class={cn("flex flex-col gap-5 outline-none", local.class)} {...others} />;
};

export { Tabs, TabsContent, TabsList, TabsTrigger };
