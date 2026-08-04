import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Cpu,
  ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import type {
  ConfigIssue,
  CredentialReference,
  GenericJsonProtocolConfig,
  ImageGenerateSettings,
  JsonObject,
  ModelConfig,
  ProviderConfig,
  RemoteModel,
} from "./types";

const BUILT_INS = ["openai-images", "gemini-generate-content"];
const EMPTY_PROVIDER: ProviderConfig = { baseUrl: "https://", protocol: "openai-images" };
const EMPTY_MODEL: ModelConfig = {
  provider: "",
  id: "",
  capabilities: { imageInput: "none", n: false, size: false, qualityValues: [] },
};
const EMPTY_PROTOCOL: GenericJsonProtocolConfig = {
  type: "generic-json",
  request: { url: "generate" },
  response: { imagePaths: ["data.*.url"] },
};

type Notice = { kind: "success" | "error"; text: string } | undefined;

export default function App() {
  const [settings, setSettings] = useState<ImageGenerateSettings>();
  const [notice, setNotice] = useState<Notice>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ settings: ImageGenerateSettings }>("/api/settings")
      .then(({ settings }) => setSettings(settings))
      .catch((error) => setNotice({ kind: "error", text: error.message }));
  }, []);

  async function validate() {
    if (!settings) return;
    setBusy(true);
    try {
      await api("/api/validate", { method: "POST", body: JSON.stringify(settings) });
      setNotice({ kind: "success", text: "Configuration is valid." });
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify(settings) });
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

  if (!settings) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-400">
        Loading configuration…
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 text-cyan-300">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
                <ImageIcon className="size-5" />
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.24em]">
                Pi extension control plane
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Image Generator
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Connect image providers, map their models, and keep generation limits in one local
              configuration.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={cancel}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button variant="secondary" disabled={busy} onClick={validate}>
              <CheckCircle2 className="size-4" />
              Validate
            </Button>
            <Button disabled={busy} onClick={save}>
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        </header>

        {notice && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200"}`}
          >
            {notice.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="whitespace-pre-wrap">{notice.text}</span>
          </div>
        )}

        <Tabs defaultValue="general">
          <TabsList className="mb-5 w-full overflow-x-auto md:w-fit">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="protocols">Protocols</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <General settings={settings} update={setSettings} />
          </TabsContent>
          <TabsContent value="providers">
            <Providers settings={settings} update={setSettings} />
          </TabsContent>
          <TabsContent value="models">
            <Models settings={settings} update={setSettings} />
          </TabsContent>
          <TabsContent value="protocols">
            <Protocols settings={settings} update={setSettings} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function General({ settings, update }: EditorProps) {
  const modelIds = Object.keys(settings.models);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card>
        <CardHeader>
          <SectionTitle
            icon={Cpu}
            title="Runtime defaults"
            subtitle="The tool schema follows the selected model."
          />
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Default model">
            <Select
              value={settings.defaultModel}
              onValueChange={(defaultModel) => update({ ...settings, defaultModel })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add a model first" />
              </SelectTrigger>
              <SelectContent>
                {modelIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Output directory">
            <Input
              value={settings.outputDir}
              onChange={(event) => update({ ...settings, outputDir: event.target.value })}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionTitle
            icon={Boxes}
            title="Safety limits"
            subtitle="Requests outside these bounds are rejected before files are written."
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Object.entries(settings.limits).map(([key, value]) => (
            <Field key={key} label={splitLabel(key)}>
              <Input
                type="number"
                min={1}
                value={value}
                onChange={(event) =>
                  update({
                    ...settings,
                    limits: { ...settings.limits, [key]: Number(event.target.value) },
                  })
                }
              />
            </Field>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Providers({ settings, update }: EditorProps) {
  const protocols = [...BUILT_INS, ...Object.keys(settings.protocols)];
  const add = () =>
    update({
      ...settings,
      providers: uniqueInsert(settings.providers, "provider", EMPTY_PROVIDER),
    });
  return (
    <Stack
      title="Provider gateways"
      description="Define HTTP endpoints and where credentials are resolved."
      icon={Server}
      action={
        <Button onClick={add}>
          <Plus className="size-4" />
          Add provider
        </Button>
      }
    >
      {Object.entries(settings.providers).map(([id, provider]) => (
        <EntityCard
          key={id}
          title={provider.name || id}
          code={id}
          onDelete={() => update({ ...settings, providers: omit(settings.providers, id) })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider ID">
              <Input
                value={id}
                onChange={(event) =>
                  update({
                    ...settings,
                    providers: rename(settings.providers, id, event.target.value, provider),
                  })
                }
              />
            </Field>
            <Field label="Display name">
              <Input
                value={provider.name ?? ""}
                onChange={(event) =>
                  patchProvider(settings, update, id, { name: optional(event.target.value) })
                }
              />
            </Field>
            <Field label="Base URL">
              <Input
                value={provider.baseUrl}
                onChange={(event) =>
                  patchProvider(settings, update, id, { baseUrl: event.target.value })
                }
              />
            </Field>
            <Field label="Protocol">
              <Select
                value={provider.protocol}
                onValueChange={(protocol) => patchProvider(settings, update, id, { protocol })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <CredentialFields
              value={provider.credential}
              onChange={(credential) => patchProvider(settings, update, id, { credential })}
            />
            <JsonField
              className="md:col-span-2"
              label="Secret headers JSON"
              value={provider.headers ?? []}
              onChange={(headers) =>
                patchProvider(settings, update, id, {
                  headers: headers as ProviderConfig["headers"],
                })
              }
            />
          </div>
        </EntityCard>
      ))}
      {Object.keys(settings.providers).length === 0 && (
        <Empty text="No providers configured. Add the endpoint that serves your image model." />
      )}
    </Stack>
  );
}

function Models({ settings, update }: EditorProps) {
  const providers = Object.keys(settings.providers);
  const [providerId, setProviderId] = useState(providers[0] ?? "");
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string>();
  const add = () =>
    update({
      ...settings,
      models: uniqueInsert(settings.models, "model", {
        ...EMPTY_MODEL,
        provider: providers[0] ?? "",
      }),
    });
  async function discover() {
    if (!providerId) return;
    setLoading(true);
    setFetched(false);
    setDiscoveryError(undefined);
    try {
      const result = await api<{ models: RemoteModel[] }>("/api/models", {
        method: "POST",
        body: JSON.stringify({ providerId, settings }),
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
  function addSelected() {
    let models = settings.models;
    for (const remote of remoteModels.filter((model) => selected.includes(model.id))) {
      if (
        Object.values(models).some(
          (model) => model.provider === providerId && model.id === remote.id,
        )
      )
        continue;
      models = uniqueInsert(models, `${providerId}/${remote.id}`, {
        ...EMPTY_MODEL,
        provider: providerId,
        id: remote.id,
        ...(remote.name ? { name: remote.name } : {}),
      });
    }
    update({ ...settings, models });
    setSelected([]);
  }
  const visibleModels = remoteModels.filter((model) =>
    `${model.id} ${model.name ?? ""} ${model.description ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <Stack
      title="Model map"
      description="Discover provider models or map a remote model manually."
      icon={Cpu}
      action={
        <Button variant="secondary" onClick={add}>
          <Plus className="size-4" />
          Add manually
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-white">Discover remote models</h3>
          <p className="mt-1 text-sm text-slate-400">
            Fetch the selected provider's /models endpoint, then choose models to add.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Select
              value={providerId}
              onValueChange={(value) => {
                setProviderId(value);
                setRemoteModels([]);
                setSelected([]);
                setFetched(false);
                setQuery("");
              }}
            >
              <SelectTrigger className="md:w-64">
                <SelectValue placeholder="Add a provider first" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((value) => (
                  <SelectItem key={value} value={value}>
                    {settings.providers[value]?.name || value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!providerId || loading} onClick={discover}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Fetching…" : "Fetch models"}
            </Button>
          </div>
          {discoveryError && <p className="text-sm text-rose-300">{discoveryError}</p>}
          {fetched && remoteModels.length === 0 && (
            <Empty text="This provider returned no models." />
          )}
          {remoteModels.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
              <label className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <Search className="size-4 text-slate-500" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                  placeholder="Search remote models…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="max-h-80 overflow-y-auto p-2">
                {visibleModels.map((model) => {
                  const added = Object.values(settings.models).some(
                    (existing) => existing.provider === providerId && existing.id === model.id,
                  );
                  return (
                    <label
                      key={model.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-cyan-300"
                        disabled={added}
                        checked={added || selected.includes(model.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, model.id]
                              : current.filter((id) => id !== model.id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block font-mono text-sm text-slate-200">{model.id}</span>
                        {(model.name || model.description) && (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {[model.name, model.description].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      {added && <span className="ml-auto text-xs text-emerald-300">Added</span>}
                    </label>
                  );
                })}
                {visibleModels.length === 0 && <Empty text="No models match this search." />}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                <span className="text-xs text-slate-500">{selected.length} selected</span>
                <Button disabled={selected.length === 0} onClick={addSelected}>
                  <Plus className="size-4" />
                  Add selected
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {Object.entries(settings.models).map(([id, model]) => (
        <EntityCard
          key={id}
          title={model.name || id}
          code={model.id || "remote ID required"}
          onDelete={() =>
            update({
              ...settings,
              models: omit(settings.models, id),
              ...(settings.defaultModel === id ? { defaultModel: undefined } : {}),
            })
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Local model ID">
              <Input
                value={id}
                onChange={(event) =>
                  update({
                    ...settings,
                    models: rename(settings.models, id, event.target.value, model),
                    defaultModel:
                      settings.defaultModel === id ? event.target.value : settings.defaultModel,
                  })
                }
              />
            </Field>
            <Field label="Display name">
              <Input
                value={model.name ?? ""}
                onChange={(event) =>
                  patchModel(settings, update, id, { name: optional(event.target.value) })
                }
              />
            </Field>
            <Field label="Provider">
              <Select
                value={model.provider}
                onValueChange={(provider) => patchModel(settings, update, id, { provider })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add a provider first" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Remote model ID">
              <Input
                value={model.id}
                onChange={(event) => patchModel(settings, update, id, { id: event.target.value })}
              />
            </Field>
            <Field label="Image input">
              <Select
                value={model.capabilities.imageInput}
                onValueChange={(imageInput: "none" | "single" | "multiple") =>
                  patchCapabilities(settings, update, id, { imageInput })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["none", "single", "multiple"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quality values">
              <Input
                placeholder="standard, high"
                value={model.capabilities.qualityValues.join(", ")}
                onChange={(event) =>
                  patchCapabilities(settings, update, id, {
                    qualityValues: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Toggle
              label="Multiple outputs (n)"
              checked={model.capabilities.n}
              onChange={(n) => patchCapabilities(settings, update, id, { n })}
            />
            <Toggle
              label="Custom size"
              checked={model.capabilities.size}
              onChange={(size) => patchCapabilities(settings, update, id, { size })}
            />
            <JsonField
              label="Defaults JSON"
              value={model.defaults ?? {}}
              onChange={(defaults) =>
                patchModel(settings, update, id, { defaults: defaults as JsonObject })
              }
            />
            <JsonField
              label="Parameter map JSON"
              value={model.parameterMap ?? {}}
              onChange={(parameterMap) =>
                patchModel(settings, update, id, {
                  parameterMap: parameterMap as ModelConfig["parameterMap"],
                })
              }
            />
            <JsonField
              className="md:col-span-2"
              label="Protocol overrides JSON"
              value={model.protocolOverrides ?? {}}
              onChange={(protocolOverrides) =>
                patchModel(settings, update, id, {
                  protocolOverrides: protocolOverrides as JsonObject,
                })
              }
            />
          </div>
        </EntityCard>
      ))}
      {Object.keys(settings.models).length === 0 && (
        <Empty text="No models configured. Models define which arguments the image_generate tool exposes." />
      )}
    </Stack>
  );
}

function Protocols({ settings, update }: EditorProps) {
  const add = () =>
    update({
      ...settings,
      protocols: uniqueInsert(settings.protocols, "protocol", EMPTY_PROTOCOL),
    });
  return (
    <Stack
      title="Request protocols"
      description="Built-ins cover OpenAI Images and Gemini. Add generic JSON only for other APIs."
      icon={Boxes}
      action={
        <Button onClick={add}>
          <Plus className="size-4" />
          Add generic protocol
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {BUILT_INS.map((id) => (
          <Card key={id}>
            <CardContent>
              <div className="mb-2 font-mono text-sm text-cyan-200">{id}</div>
              <p className="text-sm text-slate-400">
                Built in and configured through provider and model fields.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {Object.entries(settings.protocols).map(([id, protocol]) => (
        <EntityCard
          key={id}
          title={id}
          code="generic-json"
          onDelete={() => update({ ...settings, protocols: omit(settings.protocols, id) })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Protocol ID">
              <Input
                value={id}
                onChange={(event) =>
                  update({
                    ...settings,
                    protocols: rename(settings.protocols, id, event.target.value, protocol),
                  })
                }
              />
            </Field>
            <div />
            <JsonField
              label="Request JSON"
              value={protocol.request}
              onChange={(request) =>
                patchProtocol(settings, update, id, {
                  request: request as GenericJsonProtocolConfig["request"],
                })
              }
            />
            <JsonField
              label="Response JSON"
              value={protocol.response}
              onChange={(response) =>
                patchProtocol(settings, update, id, {
                  response: response as GenericJsonProtocolConfig["response"],
                })
              }
            />
            <JsonField
              className="md:col-span-2"
              label="Poll JSON (optional)"
              value={protocol.poll ?? {}}
              onChange={(poll) =>
                patchProtocol(settings, update, id, {
                  poll: Object.keys(poll as object).length
                    ? (poll as GenericJsonProtocolConfig["poll"])
                    : undefined,
                })
              }
            />
          </div>
        </EntityCard>
      ))}
    </Stack>
  );
}

function CredentialFields({
  value,
  onChange,
}: {
  value?: CredentialReference;
  onChange: (value?: CredentialReference) => void;
}) {
  const source = value?.source ?? "none";
  return (
    <>
      <Field label="Credential source">
        <Select
          value={source}
          onValueChange={(next) =>
            onChange(
              next === "none"
                ? undefined
                : next === "pi-auth"
                  ? { source: "pi-auth" }
                  : { source: next as "env" | "literal", value: "" },
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["none", "env", "literal", "pi-auth"].map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {value && value.source !== "pi-auth" ? (
        <Field label={value.source === "env" ? "Environment variable" : "API key / token"}>
          <Input
            type={value.source === "literal" ? "password" : "text"}
            autoComplete="off"
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
          />
        </Field>
      ) : (
        <div />
      )}
    </>
  );
}

function JsonField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);
  return (
    <Field label={label} className={className}>
      <Textarea
        value={text}
        aria-invalid={invalid}
        className={invalid ? "border-rose-400/60" : ""}
        onChange={(event) => {
          setText(event.target.value);
          try {
            onChange(JSON.parse(event.target.value));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
    </Field>
  );
}

function Stack({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Server;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={Icon} title={title} subtitle={description} />
        {action}
      </div>
      {children}
    </div>
  );
}
function EntityCard({
  title,
  code,
  onDelete,
  children,
}: {
  title: string;
  code: string;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <code className="text-xs text-slate-500">{code}</code>
        </div>
        <Button variant="destructive" aria-label={`Delete ${title}`} onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Server;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 text-cyan-300">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex h-10 items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3">
      <span className="text-sm text-slate-300">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

type EditorProps = {
  settings: ImageGenerateSettings;
  update: (settings: ImageGenerateSettings) => void;
};
function patchProvider(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ProviderConfig>,
) {
  update({
    ...settings,
    providers: {
      ...settings.providers,
      [id]: { ...settings.providers[id], ...patch } as ProviderConfig,
    },
  });
}
function patchModel(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ModelConfig>,
) {
  update({
    ...settings,
    models: { ...settings.models, [id]: { ...settings.models[id], ...patch } as ModelConfig },
  });
}
function patchCapabilities(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<ModelConfig["capabilities"]>,
) {
  const model = settings.models[id];
  if (model)
    patchModel(settings, update, id, { capabilities: { ...model.capabilities, ...patch } });
}
function patchProtocol(
  settings: ImageGenerateSettings,
  update: EditorProps["update"],
  id: string,
  patch: Partial<GenericJsonProtocolConfig>,
) {
  update({
    ...settings,
    protocols: {
      ...settings.protocols,
      [id]: { ...settings.protocols[id], ...patch } as GenericJsonProtocolConfig,
    },
  });
}
function omit<T>(record: Record<string, T>, id: string) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}
function rename<T>(record: Record<string, T>, oldId: string, newId: string, value: T) {
  if (!newId || newId === oldId || record[newId]) return record;
  return Object.fromEntries(
    Object.entries(record).map(([id, item]) => (id === oldId ? [newId, value] : [id, item])),
  );
}
function uniqueInsert<T>(record: Record<string, T>, base: string, value: T) {
  let id = base;
  let suffix = 2;
  while (record[id]) id = `${base}-${suffix++}`;
  return { ...record, [id]: structuredClone(value) };
}
function optional(value: string) {
  return value.trim() || undefined;
}
function splitLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = (data.issues as ConfigIssue[] | undefined)
      ?.map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(issues || data.error || `Request failed (${response.status}).`);
  }
  return data as T;
}
