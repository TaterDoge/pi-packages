import { Button } from "@taterdoge/ui/components/ui/button";
import { toast } from "@taterdoge/ui/components/ui/sonner";
import { applyTheme, initialTheme, type Theme } from "@taterdoge/ui/lib/theme";
import { MoonIcon, RotateCcwIcon, SunIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConfigIssue, ConfigPayload, PreviewPayload } from "../../src/settings/protocol.ts";
import type { ComponentId, PiStatusConfig, Zone } from "../../src/types.ts";
import { Canvas, LayoutProvider, PREVIEW_COLUMNS } from "./canvas";
import { enabledIds, type Layout, moveInLayout, toComponents, toLayout } from "./layout";
import { SettingsPanel, visibleWidth } from "./settings-panel";
import { Tray } from "./tray";

export default function App() {
  const [payload, setPayload] = useState<ConfigPayload>();
  const [config, setConfig] = useState<PiStatusConfig>();
  const [layout, setLayout] = useState<Layout>();
  const [preview, setPreview] = useState<PreviewPayload>();
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => applyTheme(theme), [theme]);

  // Tell the extension when the tab goes away, else it keeps the server (and the command)
  // waiting for the 10 minute idle timeout. A back/forward cache entry can come back, so it
  // only counts as gone when the browser is not parking it.
  useEffect(() => {
    const leave = (event: PageTransitionEvent) => {
      if (!event.persisted) navigator.sendBeacon(`/api/leave?page=${pageId}`);
    };
    addEventListener("pagehide", leave);
    return () => removeEventListener("pagehide", leave);
  }, []);

  useEffect(() => {
    void api<ConfigPayload>("/api/config")
      .then((data) => {
        setPayload(data);
        setConfig(data.config);
        setLayout(toLayout(data.config));
      })
      .catch((error: Error) => notify("error", error.message));
  }, []);

  const samples = payload?.samples ?? {};

  const draft = useMemo<PiStatusConfig | undefined>(() => {
    if (!config || !layout) return undefined;
    return { ...config, components: toComponents(layout, config) };
  }, [config, layout]);

  const requestPreview = useCallback((next: PiStatusConfig) => {
    void api<PreviewPayload>("/api/preview", {
      method: "POST",
      body: JSON.stringify({ config: next, width: PREVIEW_COLUMNS }),
    })
      .then(setPreview)
      .catch(() => setPreview(undefined));
  }, []);

  // Preview is server-rendered through the same fitBorder path as the editor, so this is the
  // only way to know where the right-hand zone gets truncated.
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => requestPreview(draft), 120);
    return () => clearTimeout(timer);
  }, [draft, requestPreview]);

  const moveId = useCallback((id: ComponentId, to: Zone | "tray", index?: number) => {
    setLayout((current) => (current ? moveInLayout(current, id, to, index) : current));
  }, []);

  function resetDefaults() {
    if (!payload) return;
    setConfig(payload.defaults);
    setLayout(toLayout(payload.defaults));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await api("/api/config", { method: "POST", body: JSON.stringify(draft) });
      // Keep `busy` set: the server is gone once this returns, so a second Save can only fail.
      notify("success", "Saved. You can close this page.");
      setTimeout(() => window.close(), 400);
    } catch (error) {
      notify("error", (error as Error).message);
      setBusy(false);
    }
  }

  async function cancel() {
    await api("/api/cancel", { method: "POST", body: "{}" }).catch(() => undefined);
    window.close();
  }

  if (!payload || !config || !layout) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading pi-status layout…
      </main>
    );
  }

  // The config validator clamps an over-wide separator; blocking Save keeps the preview honest.
  const separatorTooWide = visibleWidth(config.separator) > payload.meta.maxSeparatorWidth;
  // A component is "turned off" when it sits in none of the four zone lists.
  const enabled = new Set(enabledIds(layout));
  const disabled = config.components
    .filter((component) => !enabled.has(component.id))
    .map((component) => component.id);

  return (
    <main className="mx-auto flex min-h-screen min-w-fit flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-lg">{payload.meta.title} layout</h1>
          <p className="text-muted-foreground text-sm">{payload.meta.subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </header>

      <LayoutProvider layout={layout} onMove={moveId}>
        <div className="grid flex-1 items-start gap-5 lg:grid-cols-[260px_1fr]">
          <SettingsPanel
            separator={config.separator}
            contextBarStyle={config.contextBarStyle}
            contextBarStyles={payload.contextBarStyles}
            meta={payload.meta}
            onSeparator={(separator) => setConfig({ ...config, separator })}
            onContextBarStyle={(contextBarStyle) => setConfig({ ...config, contextBarStyle })}
          />
          <div className="flex flex-col gap-4">
            <Canvas layout={layout} preview={preview} samples={samples} onMove={moveId} />
            <Tray disabled={disabled} samples={samples} onEnable={(id) => moveId(id, "top-left")} />
          </div>
        </div>
      </LayoutProvider>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="font-mono text-muted-foreground text-xs">{payload.meta.targetPath}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={resetDefaults} disabled={busy}>
            <RotateCcwIcon /> Reset defaults
          </Button>
          <Button variant="outline" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || separatorTooWide}>
            Save &amp; apply
          </Button>
        </div>
      </footer>
    </main>
  );
}

// Errors carry the full validator list, so a longer timeout keeps a multi-line toast readable.
function notify(type: "success" | "error", title: string) {
  const duration = type === "error" ? 8000 : 3000;
  if (type === "success") toast.success(title, { duration });
  else toast.error(title, { duration });
}

// Identifies this page instance: a refresh's stale leave beacon carries the previous one, and the
// server ignores it instead of shutting down while the new page is still being edited.
const pageId = crypto.randomUUID();

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", "x-page-id": pageId, ...(init?.headers ?? {}) },
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
