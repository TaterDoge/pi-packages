import {
  FieldDescription,
  FieldError,
  FieldLabel,
  Field as FieldPrimitive,
} from "@taterdoge/ui/components/ui/field";
import { Input } from "@taterdoge/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taterdoge/ui/components/ui/select";
import { Switch } from "@taterdoge/ui/components/ui/switch";
import { Textarea } from "@taterdoge/ui/components/ui/textarea";
import type { SelectOption, SettingsField } from "../../../src/settings/types.ts";

export type FieldBinding = {
  value: unknown;
  onChange: (next: unknown) => void;
  error?: string;
};

export type SelectOptions = (field: Extract<SettingsField, { kind: "select" }>) => SelectOption[];

/** Renders one scalar field. Container kinds (record/list) are handled by containers.tsx. */
export function ScalarField(props: {
  field: SettingsField;
  binding: FieldBinding;
  options: SelectOptions;
}) {
  const { field, binding } = props;
  const invalid = Boolean(binding.error);

  if (field.kind === "switch") {
    return (
      <FieldPrimitive orientation="horizontal">
        <FieldLabel>{field.label}</FieldLabel>
        <Switch
          checked={Boolean(binding.value)}
          onCheckedChange={(next: boolean) => binding.onChange(next)}
        />
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      </FieldPrimitive>
    );
  }

  const control = renderControl();

  return (
    <FieldPrimitive data-invalid={invalid || undefined}>
      <FieldLabel>{field.label}</FieldLabel>
      {control}
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      {binding.error ? <FieldError>{binding.error}</FieldError> : null}
    </FieldPrimitive>
  );

  function renderControl() {
    switch (field.kind) {
      case "text":
        return (
          <Input
            value={asText(binding.value)}
            placeholder={field.placeholder}
            className={field.mono ? "font-mono text-xs" : undefined}
            onChange={(event) => binding.onChange(event.currentTarget.value)}
          />
        );
      case "password":
        return (
          <Input
            type="password"
            autoComplete="off"
            value={asText(binding.value)}
            placeholder={field.placeholder}
            onChange={(event) => binding.onChange(event.currentTarget.value)}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={asText(binding.value)}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              const parsed = Number(raw);
              binding.onChange(raw === "" || Number.isNaN(parsed) ? undefined : parsed);
            }}
          />
        );
      case "json":
        return (
          <Textarea
            className="min-h-32 font-mono text-xs"
            value={asJsonText(binding.value)}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              try {
                binding.onChange(JSON.parse(raw) as unknown);
              } catch {
                binding.onChange(raw);
              }
            }}
          />
        );
      case "tags":
        return (
          <Input
            value={Array.isArray(binding.value) ? binding.value.join(", ") : ""}
            placeholder={field.placeholder}
            onChange={(event) =>
              binding.onChange(
                event.currentTarget.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              )
            }
          />
        );
      case "select":
        return (
          <Select
            value={asText(binding.value)}
            onValueChange={(next: string | null) => binding.onChange(next ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {props.options(field).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  }
}

export function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asJsonText(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "";
  }
}
