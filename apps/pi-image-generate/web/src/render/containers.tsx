import { Button } from "@taterdoge/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@taterdoge/ui/components/ui/card";
import { Input } from "@taterdoge/ui/components/ui/input";
import { Label } from "@taterdoge/ui/components/ui/label";
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { getPath, setPath, uniqueKey } from "../../../src/settings/path.ts";
import type { SettingsField, SettingsValue } from "../../../src/settings/types.ts";
import { asText, type FieldBinding, ScalarField, type SelectOptions } from "./scalar.tsx";

export type FieldProps = {
  field: SettingsField;
  /** The subtree this field owns. For nested fields this is the parent item, not the root. */
  value: unknown;
  /** The item `visibleWhen` is evaluated against — the record row or list entry, not the field value. */
  scope?: unknown;
  onChange: (next: unknown) => void;
  options: SelectOptions;
  errors?: Record<string, string>;
  /** Present when the host can run the extension's cascade rule for record deletions. */
  deleteRecord?: (recordPath: string, id: string) => void;
  /** Runs a descriptor action; the server decides what the new draft looks like. */
  runAction?: (action: string) => void;
  busy?: boolean;
};

export function FieldRenderer(props: FieldProps) {
  const { field } = props;
  if (isHidden(field, props.scope)) return null;
  if (field.kind === "record") return <RecordEditor {...props} field={field} />;
  if (field.kind === "list") return <ListEditor {...props} field={field} />;
  if (field.kind === "action")
    return <ActionButton field={field} onRun={props.runAction} busy={props.busy} />;
  const binding: FieldBinding = {
    value: props.value,
    onChange: props.onChange,
    error: props.errors?.[field.path],
  };
  return <ScalarField field={field} binding={binding} options={props.options} />;
}

function isHidden(field: SettingsField, scope: unknown): boolean {
  if (!("visibleWhen" in field) || !field.visibleWhen) return false;
  const { path, equals, in: allowed } = field.visibleWhen;
  const current = getPath(scope as SettingsValue, path);
  if (allowed) return !allowed.includes(current as string | number | boolean);
  return current !== equals;
}

function ActionButton(props: {
  field: Extract<SettingsField, { kind: "action" }>;
  onRun?: (action: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={props.field.variant ?? "outline"}
        disabled={props.busy}
        className="w-fit"
        onClick={() => props.onRun?.(props.field.action)}
      >
        {props.field.label}
      </Button>
      {props.field.description ? (
        <p className="text-xs text-muted-foreground">{props.field.description}</p>
      ) : null}
    </div>
  );
}

function RecordEditor(props: FieldProps & { field: Extract<SettingsField, { kind: "record" }> }) {
  const entries = asRecord(props.value);
  const ids = Object.keys(entries);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{props.field.title ?? props.field.label}</h3>
          {props.field.description ? (
            <p className="text-xs text-muted-foreground">{props.field.description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const id = uniqueKey(entries, props.field.itemCode ?? "item");
            props.onChange({ ...entries, [id]: structuredClone(props.field.newItem) });
          }}
        >
          <PlusIcon />
          {props.field.addLabel ?? "Add"}
        </Button>
      </div>

      {ids.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing here yet.
        </p>
      ) : null}

      {ids.map((id) => (
        <RecordRow
          key={id}
          id={id}
          item={entries[id]}
          field={props.field}
          options={props.options}
          onChange={(next) => props.onChange({ ...entries, [id]: next })}
          onRename={(next) => props.onChange(rename(entries, id, next))}
          onDelete={() => {
            // Cascade belongs to the extension, so the host runs it and hands back the result.
            if (props.deleteRecord) props.deleteRecord(props.field.path, id);
            else
              props.onChange(
                Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id)),
              );
          }}
        />
      ))}
    </div>
  );
}

function RecordRow(props: {
  id: string;
  item: unknown;
  field: Extract<SettingsField, { kind: "record" }>;
  options: SelectOptions;
  onChange: (next: unknown) => void;
  onRename: (next: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDownIcon
            className={open ? "size-4 shrink-0" : "size-4 shrink-0 -rotate-90"}
            aria-hidden
          />
          <span className="truncate font-mono text-xs text-muted-foreground">{props.id}</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${props.id}`}
            onClick={props.onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`id-${props.id}`}>Identifier</Label>
            <Input
              id={`id-${props.id}`}
              defaultValue={props.id}
              className="font-mono text-xs"
              onBlur={(event) => {
                const next = event.currentTarget.value.trim();
                if (next && next !== props.id) props.onRename(next);
                else event.currentTarget.value = props.id;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.currentTarget.value = props.id;
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
          <NestedFields
            fields={props.field.fields}
            item={props.item}
            options={props.options}
            onChange={props.onChange}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

function ListEditor(props: FieldProps & { field: Extract<SettingsField, { kind: "list" }> }) {
  const items = Array.isArray(props.value) ? props.value : [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{props.field.label}</h3>
          {props.field.description ? (
            <p className="text-xs text-muted-foreground">{props.field.description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => props.onChange([...items, structuredClone(props.field.newItem)])}
        >
          <PlusIcon />
          {props.field.addLabel ?? "Add"}
        </Button>
      </div>
      {items.map((item, index) => (
        // A list of plain objects has no stable id of its own; a `name` key is the only
        // thing the descriptor guarantees (headers, for instance). Otherwise the position is it.
        <Card key={listKey(item, index)}>
          <CardContent className="grid gap-4 pt-5">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove entry"
                onClick={() => props.onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <NestedFields
              fields={props.field.fields}
              item={item}
              options={props.options}
              deleteRecord={props.deleteRecord}
              onChange={(next) =>
                props.onChange(items.map((current, i) => (i === index ? next : current)))
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Binds field paths relative to `item`. Paths use the same dotted syntax as the root. */
export function NestedFields(props: {
  fields: SettingsField[];
  item: unknown;
  options: SelectOptions;
  onChange: (next: unknown) => void;
  deleteRecord?: (recordPath: string, id: string) => void;
}) {
  const read = (path: string) => getPath(props.item as SettingsValue, path);
  const write = (path: string, value: unknown) =>
    props.onChange(setPath(props.item as SettingsValue, path, value as SettingsValue));

  return (
    <>
      {props.fields.map((field) => {
        const path = "path" in field ? field.path : undefined;
        return (
          <FieldRenderer
            key={path ?? ("action" in field ? `action-${field.action}` : field.kind)}
            field={field}
            scope={props.item}
            value={path === undefined ? undefined : read(path)}
            options={props.options}
            deleteRecord={props.deleteRecord}
            onChange={(next) => {
              if (path !== undefined) write(path, next);
            }}
          />
        );
      })}
    </>
  );
}

/** Rekeys an entry, keeping its position. A taken id keeps the original. */
export function rename(
  entries: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> {
  if (from === to || to in entries) return entries;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key === from) output[to] = value;
    else output[key] = value;
  }
  return output;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function listKey(item: unknown, index: number): string {
  const name = asRecord(item).name;
  return typeof name === "string" && name ? `name:${name}` : `index:${index}`;
}

export { asText };
