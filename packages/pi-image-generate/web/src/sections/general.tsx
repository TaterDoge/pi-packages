import { For } from "solid-js";
import { Field, SelectBox } from "@/components/fields";
import { SectionTitle } from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type EditorProps, LIMIT_LABELS, splitLabel } from "@/lib/settings";

export function General(props: EditorProps) {
  const modelIds = () => Object.keys(props.settings.models);
  return (
    <div class="grid items-start gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <SectionTitle
            icon="lucide--cpu"
            title="Runtime defaults"
            subtitle="The tool schema follows the selected model."
          />
        </CardHeader>
        <CardContent class="grid gap-4">
          <Field label="Default model">
            <SelectBox
              value={props.settings.defaultModel ?? ""}
              placeholder="Add a model first"
              options={modelIds().map((id) => ({ label: id, value: id }))}
              onChange={(defaultModel) =>
                props.update({ ...props.settings, defaultModel: defaultModel || undefined })
              }
            />
          </Field>
          <Field label="Output directory">
            <Input
              value={props.settings.outputDir}
              onInput={(event) =>
                props.update({ ...props.settings, outputDir: event.currentTarget.value })
              }
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionTitle
            icon="lucide--boxes"
            title="Safety limits"
            subtitle="Requests outside these bounds are rejected before files are written."
          />
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-2">
          <For each={Object.entries(props.settings.limits)}>
            {([key, value]) => (
              <Field label={LIMIT_LABELS[key] ?? splitLabel(key)}>
                <Input
                  type="number"
                  min={1}
                  value={value}
                  onInput={(event) =>
                    props.update({
                      ...props.settings,
                      limits: {
                        ...props.settings.limits,
                        [key]: Number(event.currentTarget.value),
                      },
                    })
                  }
                />
              </Field>
            )}
          </For>
        </CardContent>
      </Card>
    </div>
  );
}
