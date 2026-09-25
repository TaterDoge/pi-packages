import { For, Show } from "solid-js";

import { CredentialFields, Field, IdField, JsonField, SelectBox } from "@/components/fields";
import { Empty, EntityCard, Stack } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BUILT_INS,
  type EditorProps,
  EMPTY_PROVIDER,
  omit,
  omitBy,
  optional,
  patchProvider,
  rename,
  uniqueInsert,
} from "@/lib/settings";
import type { ProviderConfig } from "@/types";

export function Providers(props: EditorProps) {
  const providerIds = () => Object.keys(props.settings.providers);
  const protocolIds = () => [...BUILT_INS, ...Object.keys(props.settings.protocols)];
  const add = () =>
    props.update({
      ...props.settings,
      providers: uniqueInsert(props.settings.providers, "provider", EMPTY_PROVIDER),
    });
  const remove = (id: string) => {
    // Cascade: backend validation rejects configs where models reference a missing provider.
    const models = omitBy(props.settings.models, (model) => model.provider !== id);
    props.update({
      ...props.settings,
      providers: omit(props.settings.providers, id),
      models,
      ...(props.settings.defaultModel && !models[props.settings.defaultModel]
        ? { defaultModel: undefined }
        : {}),
    });
  };
  const patch = (id: string, patchValue: Partial<ProviderConfig>) =>
    patchProvider(props.settings, props.update, id, patchValue);
  const doRename = (id: string, next: string) => {
    const provider = props.settings.providers[id];
    if (!provider) return false;
    const renamed = rename(props.settings.providers, id, next, provider);
    if (renamed === props.settings.providers) return false;
    props.update({ ...props.settings, providers: renamed });
    return true;
  };

  return (
    <Stack
      title="Provider gateways"
      description="Define HTTP endpoints and where credentials are resolved."
      icon="lucide--server"
      action={
        <Button size="sm" onClick={add}>
          <span class="iconify lucide--plus size-4" aria-hidden="true" />
          Add provider
        </Button>
      }
    >
      <For each={providerIds()}>
        {(id) => (
          <EntityCard
            title={props.settings.providers[id]?.name || id}
            code={id}
            onDelete={() => remove(id)}
          >
            <div class="grid gap-4 md:grid-cols-2">
              <IdField
                label="Provider ID"
                value={id}
                onCommit={(next) => doRename(id, next)}
                taken={(next) => Boolean(props.settings.providers[next])}
              />
              <Field label="Display name">
                <Input
                  value={props.settings.providers[id]?.name ?? ""}
                  onInput={(event) => patch(id, { name: optional(event.currentTarget.value) })}
                />
              </Field>
              <Field label="Base URL">
                <Input
                  value={props.settings.providers[id]?.baseUrl ?? ""}
                  onInput={(event) => patch(id, { baseUrl: event.currentTarget.value })}
                />
              </Field>
              <Field label="Protocol">
                <SelectBox
                  value={props.settings.providers[id]?.protocol ?? ""}
                  options={protocolIds().map((value) => ({ label: value, value }))}
                  onChange={(protocol) => patch(id, { protocol })}
                />
              </Field>
              <CredentialFields
                value={props.settings.providers[id]?.credential}
                onChange={(credential) => patch(id, { credential })}
              />
              <JsonField
                class="md:col-span-2"
                label="Secret headers JSON"
                value={props.settings.providers[id]?.headers ?? []}
                onChange={(headers) => patch(id, { headers: headers as ProviderConfig["headers"] })}
              />
            </div>
          </EntityCard>
        )}
      </For>
      <Show when={providerIds().length === 0}>
        <Empty text="No providers configured. Add the endpoint that serves your image model." />
      </Show>
    </Stack>
  );
}
