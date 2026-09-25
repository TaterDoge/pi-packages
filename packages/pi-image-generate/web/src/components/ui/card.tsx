import { type ComponentProps, mergeProps, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

type CardProps = ComponentProps<"div"> & { size?: "default" | "sm" };

const Card = (props: CardProps) => {
  const mergedProps = mergeProps({ size: "default" } as const, props);
  const [local, others] = splitProps(mergedProps, ["class", "size"]);
  return (
    <div
      data-slot="card"
      data-size={local.size}
      class={cn(
        "group/card flex flex-col gap-5 rounded-xl border border-border bg-card py-5 text-card-foreground shadow-sm",
        local.class,
      )}
      {...others}
    />
  );
};

type CardHeaderProps = ComponentProps<"div">;

const CardHeader = (props: CardHeaderProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-header"
      class={cn(
        "group/card-header grid auto-rows-min items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        local.class,
      )}
      {...others}
    />
  );
};

type CardTitleProps = ComponentProps<"div">;

const CardTitle = (props: CardTitleProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-title"
      class={cn("font-heading text-sm leading-none font-medium", local.class)}
      {...others}
    />
  );
};

type CardDescriptionProps = ComponentProps<"div">;

const CardDescription = (props: CardDescriptionProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-description"
      class={cn("text-xs text-muted-foreground", local.class)}
      {...others}
    />
  );
};

type CardActionProps = ComponentProps<"div">;

const CardAction = (props: CardActionProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-action"
      class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", local.class)}
      {...others}
    />
  );
};

type CardContentProps = ComponentProps<"div">;

const CardContent = (props: CardContentProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div data-slot="card-content" class={cn("px-5", local.class)} {...others} />;
};

type CardFooterProps = ComponentProps<"div">;

const CardFooter = (props: CardFooterProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div data-slot="card-footer" class={cn("flex items-center px-5", local.class)} {...others} />
  );
};

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
