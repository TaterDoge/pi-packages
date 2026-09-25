import { createEffect, createSignal, createUniqueId, type JSX, Show } from "solid-js";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CREDENTIAL_SOURCES } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { CredentialReference } from "@/types";

export function Field(props: { label: string; children: JSX.Element; class?: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children, so the label's `for` cannot be statically resolved
    <label class={cn("flex flex-col gap-2", props.class)}>
      <span class="text-sm font-medium leading-none">{props.label}</span>
      {props.children}
    </label>
  );
}

export function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = createUniqueId();
  return (
    <div class="flex h-9 items-center justify-between gap-4 rounded-md border border-input px-3">
      <label for={id} class="cursor-pointer select-none text-sm text-muted-foreground">
        {props.label}
      </label>
      <Switch id={id} checked={props.checked} onChange={props.onChange} />
    </div>
  );
}

export function JsonField(props: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  class?: string;
}) {
  const [text, setText] = createSignal(JSON.stringify(props.value ?? {}, null, 2));
  const [invalid, setInvalid] = createSignal(false);
  let lastEmitted: unknown;

  // Re-sync only when the incoming value is not the one we just produced, so
  // typing is never reformatted mid-edit.
  createEffect(() => {
    const incoming = props.value;
    if (incoming === lastEmitted) return;
    lastEmitted = incoming;
    setText(JSON.stringify(incoming ?? {}, null, 2));
  });

  return (
    <Field label={props.label} class={props.class}>
      <Textarea
        value={text()}
        aria-invalid={invalid()}
        class={invalid() ? "border-destructive/60" : undefined}
        onInput={(event) => {
          setText(event.currentTarget.value);
          try {
            const parsed = JSON.parse(event.currentTarget.value) as unknown;
            lastEmitted = parsed;
            props.onChange(parsed);
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
    </Field>
  );
}

export function IdField(props: {
  label: string;
  value: string;
  taken: (next: string) => boolean;
  onCommit: (next: string) => boolean;
}) {
  const [text, setText] = createSignal(props.value);
  const [rejected, setRejected] = createSignal(false);
  // The row is remounted whenever the id changes, so the buffer only needs to
  // follow external renames, which is what a fresh mount already does.
  const commit = () => {
    const next = text().trim();
    if (next === props.value) return;
    if (!next || props.taken(next)) {
      setText(props.value);
      setRejected(Boolean(next));
      return;
    }
    setRejected(!props.onCommit(next));
  };
  return (
    <Field label={props.label}>
      <Input
        value={text()}
        aria-invalid={rejected()}
        class={rejected() ? "border-destructive/60" : undefined}
        onInput={(event) => {
          setText(event.currentTarget.value);
          setRejected(false);
        }}
        onChange={commit}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setText(props.value);
            setRejected(false);
            event.currentTarget.blur();
          }
        }}
      />
      <Show when={rejected()}>
        <span class="text-xs text-destructive-foreground">
          ID is empty or already taken — reverted.
        </span>
      </Show>
    </Field>
  );
}

type SelectOption = { label: string; value: string };

export function SelectBox(props: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
}) {
  const selected = () => props.options.find((option) => option.value === props.value) ?? null;
  return (
    <Select<SelectOption>
      class={props.class}
      options={props.options}
      optionValue={(option) => option.value}
      optionTextValue={(option) => option.label}
      value={selected()}
      onChange={(option) => {
        if (option) props.onChange(option.value);
      }}
      placeholder={props.placeholder}
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>{itemProps.item.rawValue.label}</SelectItem>
      )}
    >
      <SelectTrigger>
        <SelectValue>
          {(state: { selectedOption: () => SelectOption | undefined }) =>
            state.selectedOption()?.label ?? props.placeholder ?? ""
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
}

export function CredentialFields(props: {
  value?: CredentialReference;
  onChange: (value?: CredentialReference) => void;
}) {
  const source = () => props.value?.source ?? "none";
  return (
    <>
      <Field label="Credential source">
        <SelectBox
          value={source()}
          options={CREDENTIAL_SOURCES.map((value) => ({ label: value, value }))}
          onChange={(next) =>
            props.onChange(
              next === "none"
                ? undefined
                : next === "pi-auth"
                  ? { source: "pi-auth" }
                  : { source: next as "env" | "literal", value: "" },
            )
          }
        />
      </Field>
      <Show
        when={props.value && props.value.source !== "pi-auth" ? props.value : undefined}
        fallback={<div />}
      >
        {(current) => (
          <Field label={current().source === "env" ? "Environment variable" : "API key / token"}>
            <Input
              type={current().source === "literal" ? "password" : "text"}
              autocomplete="off"
              value={current().value}
              onInput={(event) =>
                props.onChange({
                  source: current().source,
                  value: event.currentTarget.value,
                } as CredentialReference)
              }
            />
          </Field>
        )}
      </Show>
    </>
  );
}
