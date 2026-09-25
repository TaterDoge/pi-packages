import { createSignal, For, Show } from "solid-js";
import { Field, IdField, JsonField, SelectBox, Toggle } from "@/components/fields";
import { Empty, EntityCard, Stack } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type EditorProps,
  EMPTY_MODEL,
  IMAGE_INPUTS,
  omit,
  optional,
  patchCapabilities,
  patchModel,
  rename,
  uniqueInsert,
} from "@/lib/settings";
import type { JsonObject, ModelConfig, RemoteModel } from "@/types";

import { ModelDiscovery } from "./model-discovery";

export function Models(props: EditorProps) {
  const providerIds = () => Object.keys(props.settings.providers);
  const [providerId, setProviderId] = createSignal<string>();
  const activeProvider = () => providerId() ?? providerIds()[0] ?? "";

  const add = () =>
    props.update({
      ...props.settings,
      models: uniqueInsert(props.settings.models, "model", {
        ...EMPTY_MODEL,
        provider: providerIds()[0] ?? "",
      }),
    });

  function addDiscovered(remotes: RemoteModel[]) {
    const target = activeProvider();
    let models = props.settings.models;
    for (const remote of remotes) {
      if (
        Object.values(models).some((model) => model.provider === target && model.id === remote.id)
      )
        continue;
      models = uniqueInsert(models, `${target}/${remote.id}`, {
        ...EMPTY_MODEL,
        provider: target,
        id: remote.id,
        ...(remote.name ? { name: remote.name } : {}),
      });
    }
    props.update({ ...props.settings, models });
  }

  return (
    <Stack
      title="Model map"
      description="Discover provider models or map a remote model manually."
      icon="lucide--cpu"
      action={
        <Button variant="outline" size="sm" onClick={add}>
          <span class="iconify lucide--plus size-4" aria-hidden="true" />
          Add manually
        </Button>
      }
    >
      <ModelDiscovery
        providerIds={providerIds()}
        labelFor={(value) => props.settings.providers[value]?.name || value}
        activeProvider={activeProvider()}
        onSelectProvider={setProviderId}
        settings={props.settings}
        onAdd={addDiscovered}
      />

      <For each={Object.keys(props.settings.models)}>
        {(id) => (
          <EntityCard
            title={props.settings.models[id]?.name || id}
            code={props.settings.models[id]?.id || "remote ID required"}
            onDelete={() =>
              props.update({
                ...props.settings,
                models: omit(props.settings.models, id),
                ...(props.settings.defaultModel === id ? { defaultModel: undefined } : {}),
              })
            }
          >
            <div class="grid gap-4 md:grid-cols-2">
              <IdField
                label="Local model ID"
                value={id}
                taken={(next) => Boolean(props.settings.models[next])}
                onCommit={(next) => {
                  const model = props.settings.models[id];
                  if (!model) return false;
                  const models = rename(props.settings.models, id, next, model);
                  if (models === props.settings.models) return false;
                  props.update({
                    ...props.settings,
                    models,
                    defaultModel:
                      props.settings.defaultModel === id ? next : props.settings.defaultModel,
                  });
                  return true;
                }}
              />
              <Field label="Display name">
                <Input
                  value={props.settings.models[id]?.name ?? ""}
                  onInput={(event) =>
                    patchModel(props.settings, props.update, id, {
                      name: optional(event.currentTarget.value),
                    })
                  }
                />
              </Field>
              <Field label="Provider">
                <SelectBox
                  value={props.settings.models[id]?.provider ?? ""}
                  placeholder="Add a provider first"
                  options={providerIds().map((value) => ({ label: value, value }))}
                  onChange={(provider) =>
                    patchModel(props.settings, props.update, id, { provider })
                  }
                />
              </Field>
              <Field label="Remote model ID">
                <Input
                  value={props.settings.models[id]?.id ?? ""}
                  onInput={(event) =>
                    patchModel(props.settings, props.update, id, { id: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Image input">
                <SelectBox
                  value={props.settings.models[id]?.capabilities.imageInput ?? "none"}
                  options={IMAGE_INPUTS.map((value) => ({ label: value, value }))}
                  onChange={(imageInput) =>
                    patchCapabilities(props.settings, props.update, id, {
                      imageInput: imageInput as ModelConfig["capabilities"]["imageInput"],
                    })
                  }
                />
              </Field>
              <Field label="Quality values">
                <Input
                  placeholder="standard, high"
                  value={(props.settings.models[id]?.capabilities.qualityValues ?? []).join(", ")}
                  onInput={(event) =>
                    patchCapabilities(props.settings, props.update, id, {
                      qualityValues: event.currentTarget.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Toggle
                label="Multiple outputs (n)"
                checked={props.settings.models[id]?.capabilities.n ?? false}
                onChange={(n) => patchCapabilities(props.settings, props.update, id, { n })}
              />
              <Toggle
                label="Custom size"
                checked={props.settings.models[id]?.capabilities.size ?? false}
                onChange={(size) => patchCapabilities(props.settings, props.update, id, { size })}
              />
              <JsonField
                label="Defaults JSON"
                value={props.settings.models[id]?.defaults ?? {}}
                onChange={(defaults) =>
                  patchModel(props.settings, props.update, id, { defaults: defaults as JsonObject })
                }
              />
              <JsonField
                label="Parameter map JSON"
                value={props.settings.models[id]?.parameterMap ?? {}}
                onChange={(parameterMap) =>
                  patchModel(props.settings, props.update, id, {
                    parameterMap: parameterMap as ModelConfig["parameterMap"],
                  })
                }
              />
              <JsonField
                class="md:col-span-2"
                label="Protocol overrides JSON"
                value={props.settings.models[id]?.protocolOverrides ?? {}}
                onChange={(protocolOverrides) =>
                  patchModel(props.settings, props.update, id, {
                    protocolOverrides: protocolOverrides as JsonObject,
                  })
                }
              />
            </div>
          </EntityCard>
        )}
      </For>
      <Show when={Object.keys(props.settings.models).length === 0}>
        <Empty text="No models configured. Models define which arguments the image_generate tool exposes." />
      </Show>
    </Stack>
  );
}
