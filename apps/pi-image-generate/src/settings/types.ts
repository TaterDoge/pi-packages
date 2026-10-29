export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** An extension's settings tree. Shape is enforced by `descriptor.validate`, not by this type. */
export type SettingsValue =
  | JsonPrimitive
  | SettingsValue[]
  | { [key: string]: SettingsValue }
  | undefined;

export type ConfigIssue = { path: string; message: string };

export type SelectOption = { label: string; value: string };

type FieldBase = {
  /** Dotted path inside the value the field renders. Relative for fields nested in a record/list. */
  path: string;
  label: string;
  description?: string;
  /** Hide unless another path in the same item equals `equals` (or is one of `in`). Used for union-shaped configs. */
  visibleWhen?: {
    path: string;
    equals?: string | number | boolean;
    in?: (string | number | boolean)[];
  };
};

export type SettingsField =
  | (FieldBase & { kind: "text"; placeholder?: string; mono?: boolean })
  | (FieldBase & { kind: "password"; placeholder?: string })
  | (FieldBase & { kind: "number"; min?: number; max?: number; step?: number })
  | (FieldBase & { kind: "switch" })
  | (FieldBase & {
      kind: "select";
      options?: SelectOption[];
      /** Derive options from the keys of another record in the value, e.g. `models`. */
      from?: { path: string };
      extraOptions?: SelectOption[];
      placeholder?: string;
      allowEmpty?: boolean;
    })
  | (FieldBase & { kind: "json" })
  /** Comma-separated string list, stored as `string[]`. */
  | (FieldBase & { kind: "tags"; placeholder?: string })
  | (FieldBase & {
      kind: "record";
      title?: string;
      itemLabel?: string;
      itemCode?: string;
      addLabel?: string;
      fields: SettingsField[];
      newItem: Record<string, unknown>;
    })
  | (FieldBase & {
      kind: "list";
      addLabel?: string;
      fields: SettingsField[];
      newItem: unknown;
    })
  | {
      kind: "action";
      action: string;
      label: string;
      description?: string;
      variant?: "default" | "outline" | "ghost";
    };

export type SettingsSection = {
  id: string;
  label: string;
  icon?: string;
  title?: string;
  description?: string;
  fields: SettingsField[];
};

export type SettingsUI = { sections: SettingsSection[] };

export type SettingsActionContext = {
  /** Per-request arguments sent by the page, e.g. which provider to probe. */
  args: unknown;
  /** Runtime values injected by the owning extension (registries, clients, paths). */
  runtime?: unknown;
};

export type SettingsAction<T> = (draft: T, context: SettingsActionContext) => Promise<unknown>;

export type SettingsDescriptor<T = unknown> = {
  /** Extension id, e.g. `pi-image-generate`. Used for the page title and cookie scope. */
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  /** Paths whose leaf values are secrets. `*` matches any key or index, e.g. `providers.*.credential.value`. */
  secrets?: string[];
  /** Current persisted value, loaded once when the server starts. */
  load: () => Promise<T>;
  /** Normalize and validate a submitted draft. Omit to accept the draft as-is. */
  validate?: (draft: unknown) => { ok: true; value: T } | { ok: false; issues: ConfigIssue[] };
  save: (value: T) => Promise<void>;
  ui: SettingsUI;
  actions?: Record<string, SettingsAction<T>>;
  /**
   * Applied before removing a record entry, so the extension owns its own cascade rules
   * (dropping dependent rows, clearing a default that pointed at the entry).
   */
  onDeleteRecordItem?: (draft: T, recordPath: string, id: string) => T;
};

export type SettingsServer = {
  url: string;
  result: Promise<boolean>;
  close: () => Promise<void>;
};

export type SettingsServerOptions<T = unknown> = {
  descriptor: SettingsDescriptor<T>;
  runtime?: unknown;
  assetDir?: string;
  idleTimeoutMs?: number;
};
