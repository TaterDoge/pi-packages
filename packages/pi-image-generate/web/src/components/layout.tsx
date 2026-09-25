import type { JSX } from "solid-js";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionTitle(props: { icon: string; title: string; subtitle: string }) {
  return (
    <div class="flex items-start gap-3">
      <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-foreground">
        <span class={cn("iconify size-4", props.icon)} aria-hidden="true" />
      </span>
      <div>
        <h2 class="font-heading text-sm font-medium">{props.title}</h2>
        <p class="mt-1 text-xs text-muted-foreground">{props.subtitle}</p>
      </div>
    </div>
  );
}

export function Stack(props: {
  title: string;
  description: string;
  icon: string;
  action: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={props.icon} title={props.title} subtitle={props.description} />
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

export function EntityCard(props: {
  title: string;
  code: string;
  onDelete: () => void;
  children: JSX.Element;
}) {
  return (
    <Card>
      <CardHeader>
        <div class="min-w-0">
          <div class="truncate font-heading text-sm font-medium">{props.title}</div>
          <code class="text-xs text-muted-foreground">{props.code}</code>
        </div>
        <CardAction>
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Delete ${props.title}`}
            onClick={props.onDelete}
          >
            <span class="iconify lucide--trash-2 size-4" aria-hidden="true" />
            Delete
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

export function Empty(props: { text: string }) {
  return (
    <div class="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      {props.text}
    </div>
  );
}
