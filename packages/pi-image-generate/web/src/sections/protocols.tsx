import { For } from "solid-js";

import { IdField, JsonField } from "@/components/fields";
import { EntityCard, Stack } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BUILT_INS,
  type EditorProps,
  EMPTY_PROTOCOL,
  omit,
  patchProtocol,
  rename,
  uniqueInsert,
} from "@/lib/settings";
import type { GenericJsonProtocolConfig } from "@/types";

export function Protocols(props: EditorProps) {
  const protocolIds = () => Object.keys(props.settings.protocols);
  const add = () =>
    props.update({
      ...props.settings,
      protocols: uniqueInsert(props.settings.protocols, "protocol", EMPTY_PROTOCOL),
    });
  const patch = (id: string, patchValue: Partial<GenericJsonProtocolConfig>) =>
    patchProtocol(props.settings, props.update, id, patchValue);

  return (
    <Stack
      title="Request protocols"
      description="Built-ins cover OpenAI Images and Gemini. Add generic JSON only for other APIs."
      icon="lucide--boxes"
      action={
        <Button size="sm" onClick={add}>
          <span class="iconify lucide--plus size-4" aria-hidden="true" />
          Add generic protocol
        </Button>
      }
    >
      <div class="grid gap-4 md:grid-cols-2">
        <For each={BUILT_INS}>
          {(id) => (
            <Card>
              <CardContent class="pt-5">
                <div class="font-mono text-sm">{id}</div>
                <p class="mt-1 text-xs text-muted-foreground">
                  Built in and configured through provider and model fields.
                </p>
              </CardContent>
            </Card>
          )}
        </For>
      </div>
      <For each={protocolIds()}>
        {(id) => (
          <EntityCard
            title={id}
            code="generic-json"
            onDelete={() =>
              props.update({
                ...props.settings,
                protocols: omit(props.settings.protocols, id),
              })
            }
          >
            <div class="grid gap-4 md:grid-cols-2">
              <IdField
                label="Protocol ID"
                value={id}
                taken={(next) => Boolean(props.settings.protocols[next])}
                onCommit={(next) => {
                  const protocol = props.settings.protocols[id];
                  if (!protocol) return false;
                  const protocols = rename(props.settings.protocols, id, next, protocol);
                  if (protocols === props.settings.protocols) return false;
                  props.update({ ...props.settings, protocols });
                  return true;
                }}
              />
              <div />
              <JsonField
                label="Request JSON"
                value={props.settings.protocols[id]?.request ?? {}}
                onChange={(request) =>
                  patch(id, { request: request as GenericJsonProtocolConfig["request"] })
                }
              />
              <JsonField
                label="Response JSON"
                value={props.settings.protocols[id]?.response ?? {}}
                onChange={(response) =>
                  patch(id, { response: response as GenericJsonProtocolConfig["response"] })
                }
              />
              <JsonField
                class="md:col-span-2"
                label="Poll JSON (optional)"
                value={props.settings.protocols[id]?.poll ?? {}}
                onChange={(poll) =>
                  patch(id, {
                    poll: Object.keys(poll as object).length
                      ? (poll as GenericJsonProtocolConfig["poll"])
                      : undefined,
                  })
                }
              />
            </div>
          </EntityCard>
        )}
      </For>
    </Stack>
  );
}
