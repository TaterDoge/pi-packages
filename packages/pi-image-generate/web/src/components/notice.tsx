import { Show } from "solid-js";

import { cn } from "@/lib/utils";

export type Notice = { kind: "success" | "error"; text: string };

export function NoticeBanner(props: { notice: Notice | undefined }) {
  return (
    <Show when={props.notice}>
      {(current) => (
        <div
          class={cn(
            "mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            current().kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/10 text-destructive-foreground",
          )}
        >
          <Show
            when={current().kind === "success"}
            fallback={<span class="iconify lucide--circle-alert mt-0.5 size-4 shrink-0" />}
          >
            <span class="iconify lucide--circle-check-big mt-0.5 size-4 shrink-0" />
          </Show>
          <span class="whitespace-pre-wrap">{current().text}</span>
        </div>
      )}
    </Show>
  );
}
