import { createSignal, For, Show } from "solid-js";
import { SelectBox } from "@/components/fields";
import { Empty } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, errorText } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ImageGenerateSettings, RemoteModel } from "@/types";

export function ModelDiscovery(props: {
  providerIds: string[];
  labelFor: (id: string) => string;
  activeProvider: string;
  onSelectProvider: (id: string) => void;
  settings: ImageGenerateSettings;
  onAdd: (remoteModels: RemoteModel[]) => void;
}) {
  const [remoteModels, setRemoteModels] = createSignal<RemoteModel[]>([]);
  const [selected, setSelected] = createSignal<string[]>([]);
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [fetched, setFetched] = createSignal(false);
  const [discoveryError, setDiscoveryError] = createSignal<string>();

  const isAdded = (remote: RemoteModel) =>
    Object.values(props.settings.models).some(
      (model) => model.provider === props.activeProvider && model.id === remote.id,
    );

  async function discover() {
    const target = props.activeProvider;
    if (!target) return;
    setLoading(true);
    setFetched(false);
    setDiscoveryError(undefined);
    try {
      const result = await api<{ models: RemoteModel[] }>("/api/models", {
        method: "POST",
        body: JSON.stringify({ providerId: target, settings: props.settings }),
      });
      setRemoteModels(result.models);
      setSelected([]);
      setFetched(true);
    } catch (error) {
      setDiscoveryError(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  function resetDiscovery() {
    setRemoteModels([]);
    setSelected([]);
    setFetched(false);
    setQuery("");
    setDiscoveryError(undefined);
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  function addSelected() {
    props.onAdd(remoteModels().filter((model) => selected().includes(model.id)));
    setSelected([]);
  }

  const visibleModels = () =>
    remoteModels().filter((model) =>
      `${model.id} ${model.name ?? ""} ${model.description ?? ""}`
        .toLowerCase()
        .includes(query().toLowerCase()),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discover remote models</CardTitle>
        <CardDescription>
          Fetch the selected provider's /models endpoint, then choose models to add.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row">
          <SelectBox
            class="md:w-72"
            value={props.activeProvider}
            placeholder="Add a provider first"
            options={props.providerIds.map((value) => ({
              label: props.labelFor(value),
              value,
            }))}
            onChange={(value) => {
              props.onSelectProvider(value);
              resetDiscovery();
            }}
          />
          <Button disabled={!props.activeProvider || loading()} onClick={() => void discover()}>
            <span
              class={cn("iconify lucide--refresh-cw size-4", loading() && "animate-spin")}
              aria-hidden="true"
            />
            {loading() ? "Fetching…" : "Fetch models"}
          </Button>
        </div>
        <Show when={discoveryError()}>
          <p class="text-sm text-destructive-foreground">{discoveryError()}</p>
        </Show>
        <Show when={fetched() && remoteModels().length === 0}>
          <Empty text="This provider returned no models." />
        </Show>
        <Show when={remoteModels().length > 0}>
          <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
            <div class="flex items-center gap-3 border-b border-border px-4 py-2">
              <span
                class="iconify lucide--search size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                class="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search remote models…"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
            <div class="max-h-80 overflow-y-auto p-2">
              <For each={visibleModels()}>
                {(model) => (
                  <label class="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-accent/60">
                    <input
                      type="checkbox"
                      class="mt-1 size-4 accent-primary"
                      disabled={isAdded(model)}
                      checked={isAdded(model) || selected().includes(model.id)}
                      onChange={(event) => toggleSelected(model.id, event.currentTarget.checked)}
                    />
                    <span class="min-w-0">
                      <span class="block truncate font-mono text-sm">{model.id}</span>
                      <Show when={model.name || model.description}>
                        <span class="mt-0.5 block text-xs text-muted-foreground">
                          {[model.name, model.description].filter(Boolean).join(" · ")}
                        </span>
                      </Show>
                    </span>
                    <Show when={isAdded(model)}>
                      <span class="ml-auto text-xs text-emerald-600 dark:text-emerald-400">
                        Added
                      </span>
                    </Show>
                  </label>
                )}
              </For>
              <Show when={visibleModels().length === 0}>
                <Empty text="No models match this search." />
              </Show>
            </div>
            <div class="flex items-center justify-between border-t border-border px-4 py-3">
              <span class="text-xs text-muted-foreground">{selected().length} selected</span>
              <Button size="sm" disabled={selected().length === 0} onClick={addSelected}>
                <span class="iconify lucide--plus size-4" aria-hidden="true" />
                Add selected
              </Button>
            </div>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
