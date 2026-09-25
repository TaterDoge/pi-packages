import { createEffect, createSignal, onMount, Show } from "solid-js";

import { type Notice, NoticeBanner } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorText } from "@/lib/api";
import { applyTheme, initialTheme, type Theme } from "@/lib/theme";
import { General } from "@/sections/general";
import { Models } from "@/sections/models";
import { Protocols } from "@/sections/protocols";
import { Providers } from "@/sections/providers";
import type { ImageGenerateSettings } from "@/types";

export default function App() {
  const [settings, setSettings] = createSignal<ImageGenerateSettings>();
  const [notice, setNotice] = createSignal<Notice>();
  const [busy, setBusy] = createSignal(false);
  const [theme, setTheme] = createSignal<Theme>(initialTheme());

  createEffect(() => applyTheme(theme()));

  onMount(() => {
    void api<{ settings: ImageGenerateSettings }>("/api/settings")
      .then(({ settings }) => setSettings(settings))
      .catch((error) => setNotice({ kind: "error", text: error.message }));
  });

  async function validate() {
    const current = settings();
    if (!current) return;
    setBusy(true);
    try {
      await api("/api/validate", { method: "POST", body: JSON.stringify(current) });
      setNotice({ kind: "success", text: "Configuration is valid." });
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const current = settings();
    if (!current) return;
    setBusy(true);
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify(current) });
      setNotice({ kind: "success", text: "Saved. This page can now close." });
      setTimeout(() => window.close(), 400);
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
      setBusy(false);
    }
  }

  async function cancel() {
    await api("/api/cancel", { method: "POST" }).catch(() => undefined);
    window.close();
  }

  return (
    <Show
      when={settings()}
      fallback={
        <main class="grid min-h-screen place-items-center text-sm text-muted-foreground">
          Loading configuration…
        </main>
      }
    >
      {(current) => (
        <main class="min-h-screen">
          <header class="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
            <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
              <div class="flex items-center gap-3">
                <span class="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted text-foreground">
                  <span class="iconify lucide--image size-5" aria-hidden="true" />
                </span>
                <div>
                  <h1 class="font-heading text-lg font-medium leading-tight">Image Generator</h1>
                  <p class="text-xs text-muted-foreground">
                    Providers, models and limits for the image_generate tool
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Switch to ${theme() === "dark" ? "light" : "dark"} theme`}
                  title={`Switch to ${theme() === "dark" ? "light" : "dark"} theme`}
                  onClick={() => setTheme(theme() === "dark" ? "light" : "dark")}
                >
                  <Show
                    when={theme() === "dark"}
                    fallback={<span class="iconify lucide--sun size-4" aria-hidden="true" />}
                  >
                    <span class="iconify lucide--moon size-4" aria-hidden="true" />
                  </Show>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void cancel()}>
                  <span class="iconify lucide--x size-4" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy()}
                  onClick={() => void validate()}
                >
                  <span class="iconify lucide--circle-check-big size-4" aria-hidden="true" />
                  Validate
                </Button>
                <Button size="sm" disabled={busy()} onClick={() => void save()}>
                  <span class="iconify lucide--save size-4" aria-hidden="true" />
                  Save changes
                </Button>
              </div>
            </div>
          </header>

          <div class="mx-auto max-w-6xl px-4 py-6 md:px-8">
            <NoticeBanner notice={notice()} />

            <Tabs defaultValue="general">
              <TabsList class="w-full overflow-x-auto md:w-fit">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="providers">Providers</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="protocols">Protocols</TabsTrigger>
              </TabsList>
              <TabsContent value="general">
                <General settings={current()} update={setSettings} />
              </TabsContent>
              <TabsContent value="providers">
                <Providers settings={current()} update={setSettings} />
              </TabsContent>
              <TabsContent value="models">
                <Models settings={current()} update={setSettings} />
              </TabsContent>
              <TabsContent value="protocols">
                <Protocols settings={current()} update={setSettings} />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      )}
    </Show>
  );
}
