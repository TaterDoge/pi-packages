import { Button } from "@taterdoge/ui/components/ui/button";
import { Card, CardContent } from "@taterdoge/ui/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@taterdoge/ui/components/ui/tabs";
import { applyTheme, initialTheme, type Theme } from "@taterdoge/ui/lib/theme";
import { CheckCircleIcon, MoonIcon, SaveIcon, SunIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getPath, setPath } from "../../src/settings/path.ts";
import type {
  ConfigIssue,
  SelectOption,
  SettingsDescriptor,
  SettingsField,
  SettingsValue,
} from "../../src/settings/types.ts";
import { FieldRenderer } from "./render/containers.tsx";

type Meta = Pick<SettingsDescriptor, "id" | "title" | "subtitle" | "icon" | "ui"> & {
  actions: string[];
};

type Notice = { kind: "success" | "error"; text: string };

export default function App() {
  const [meta, setMeta] = useState<Meta>();
  const [draft, setDraft] = useState<SettingsValue>();
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    void api<Meta>("/api/meta")
      .then(setMeta)
      .catch((error: Error) => setNotice({ kind: "error", text: error.message }));
    void api<{ settings: SettingsValue }>("/api/settings")
      .then((payload) => setDraft(payload.settings))
      .catch((error: Error) => setNotice({ kind: "error", text: error.message }));
  }, []);

  const errorsByPath = useMemo(
    () => Object.fromEntries(issues.map((issue) => [issue.path, issue.message])),
    [issues],
  );

  // Record deletion cascade is the extension's rule (dropping dependent rows, clearing a
  // default that pointed at the row), so the host asks the server instead of guessing.
  const deleteRecord = useMemo(
    () => (recordPath: string, id: string) => {
      void api<{ settings: SettingsValue }>("/api/delete-record", {
        method: "POST",
        body: JSON.stringify({ draft, path: recordPath, id }),
      })
        .then((payload) => setDraft(payload.settings))
        .catch((error: Error) => setNotice({ kind: "error", text: error.message }));
    },
    [draft],
  );

  // Actions run server-side because only the extension holds credentials and network policy.
  const runAction = useMemo(
    () => (action: string) => {
      setBusy(true);
      void api<{ data: unknown }>("/api/action", {
        method: "POST",
        body: JSON.stringify({ action, draft }),
      })
        .then((payload) =>
          setNotice({ kind: "success", text: JSON.stringify(payload.data, null, 2) }),
        )
        .catch((error: Error) => setNotice({ kind: "error", text: error.message }))
        .finally(() => setBusy(false));
    },
    [draft],
  );

  const options = useMemo<SelectOptionsFn>(() => {
    return (field) => {
      const listed = field.options ?? [];
      const extra = field.extraOptions ?? [];
      const derived = field.from
        ? Object.keys(asRecord(getPath(draft, field.from.path))).map((key) => ({
            label: key,
            value: key,
          }))
        : [];
      const merged = [...derived, ...listed, ...extra];
      return field.allowEmpty ? [{ label: "— none —", value: "" }, ...merged] : merged;
    };
  }, [draft]);

  async function run(kind: "validate" | "save") {
    if (draft === undefined) return;
    setBusy(true);
    setIssues([]);
    try {
      await api(kind === "validate" ? "/api/validate" : "/api/settings", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setNotice(
        kind === "validate"
          ? { kind: "success", text: "Configuration is valid." }
          : { kind: "success", text: "Saved. This page can now close." },
      );
      if (kind === "save") setTimeout(() => window.close(), 400);
    } catch (error) {
      const failure = error as Error & { issues?: ConfigIssue[] };
      if (failure.issues) setIssues(failure.issues);
      setNotice({ kind: "error", text: failure.message });
      setBusy(false);
    }
  }

  if (!meta || draft === undefined) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading settings…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium leading-tight">{meta.title}</h1>
            {meta.subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta.subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void api("/api/cancel", { method: "POST" }).catch(() => undefined);
                window.close();
              }}
            >
              <XIcon />
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run("validate")}
            >
              <CheckCircleIcon />
              Validate
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void run("save")}>
              <SaveIcon />
              Save changes
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {notice ? (
          <Card
            className={
              notice.kind === "error"
                ? "mb-4 border-destructive/40 bg-destructive/5"
                : "mb-4 border-emerald-500/40 bg-emerald-500/5"
            }
          >
            <CardContent className="whitespace-pre-wrap py-3 text-sm">{notice.text}</CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue={meta.ui.sections[0]?.id}>
          <TabsList className="w-full overflow-x-auto md:w-fit">
            {meta.ui.sections.map((section) => (
              <TabsTrigger key={section.id} value={section.id}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {meta.ui.sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="pt-4">
              {section.title ? (
                <div className="mb-4">
                  <h2 className="text-sm font-medium">{section.title}</h2>
                  {section.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-5">
                {section.fields.map((field) => {
                  const path = pathOf(field);
                  const key = path ?? ("action" in field ? `action-${field.action}` : field.kind);
                  return (
                    <FieldRenderer
                      key={key}
                      field={field}
                      value={path === undefined ? undefined : getPath(draft, path)}
                      options={options}
                      errors={errorsByPath}
                      deleteRecord={deleteRecord}
                      runAction={runAction}
                      busy={busy}
                      onChange={(next) => {
                        if (path !== undefined)
                          setDraft(setPath(draft, path, next as SettingsValue));
                      }}
                    />
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </main>
  );
}

type SelectOptionsFn = (field: Extract<SettingsField, { kind: "select" }>) => SelectOption[];

/** Every field except `action` owns a path; returning one narrows without relying on closure inference. */
function pathOf(field: SettingsField): string | undefined {
  return "path" in field ? field.path : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const listed = (data.issues as ConfigIssue[] | undefined)
      ?.map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    const error = new Error(
      listed || (data.error as string) || `Request failed (${response.status}).`,
    ) as Error & { issues?: ConfigIssue[] };
    if (data.issues) error.issues = data.issues as ConfigIssue[];
    throw error;
  }
  return data as T;
}
