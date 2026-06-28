import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Save, RotateCcw, KeyRound, RefreshCw, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { useSettings, type AIProvider } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface ModelOption {
  id: string;
  label: string;
  hint?: string;
}

async function fetchModels(provider: AIProvider, apiKey: string): Promise<ModelOption[]> {
  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    return (data?.data ?? []).map((m: any) => ({
      id: String(m.id),
      label: String(m.name ?? m.id),
      hint: m.pricing?.prompt === "0" ? "free" : m.context_length ? `${Math.round(Number(m.context_length) / 1000)}k ctx` : undefined,
    }));
  }
  // groq requer auth
  if (!apiKey) throw new Error("Cole a chave Groq antes de listar modelos.");
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return (data?.data ?? []).map((m: any) => ({ id: String(m.id), label: String(m.id) }));
}

function ModelPicker({
  provider,
  apiKey,
  value,
  onChange,
}: {
  provider: AIProvider;
  apiKey: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchModels(provider, apiKey);
      list.sort((a, b) => a.label.localeCompare(b.label));
      setModels(list);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar modelos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // auto carrega openrouter (público); groq só ao clicar
    if (provider === "openrouter") void load();
    else setModels([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q));
  }, [query, models]);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-xs font-medium">Modelo ({models.length} disponíveis)</label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] hover:bg-surface-3 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          {loading ? "Carregando..." : "Atualizar lista"}
        </button>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (ex: deepseek, llama, free, claude)..."
          className="w-full rounded-md border border-input bg-surface-1 py-2 pl-8 pr-3 text-xs focus:border-primary/60 focus:outline-none"
        />
      </div>

      {error && <p className="mb-2 text-[10px] text-destructive">{error}</p>}

      <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-surface-2">
        {filtered.length === 0 ? (
          <p className="p-3 text-center text-[10px] text-muted-foreground">
            {loading ? "Carregando..." : models.length === 0 ? "Clique em Atualizar lista." : "Nenhum modelo encontrado."}
          </p>
        ) : (
          filtered.slice(0, 200).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-[11px] last:border-0 hover:bg-surface-3",
                value === m.id && "bg-primary/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.label}</p>
                <p className="truncate font-mono text-[9px] text-muted-foreground">{m.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.hint && <span className="text-[9px] uppercase text-muted-foreground">{m.hint}</span>}
                {value === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </button>
          ))
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Selecionado: <span className="font-mono text-primary">{value || "—"}</span>
      </p>
    </div>
  );
}

interface SecretFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

function SecretField({ label, value, onChange, placeholder, hint }: SecretFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:glow-cyber"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Ocultar" : "Mostrar"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-surface-1 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none focus:glow-cyber"
      />
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsView() {
  const { settings, update, reset } = useSettings();
  const [local, setLocal] = useState(settings);

  const handleSave = () => {
    update(local);
    toast.success("Configurações salvas no navegador (localStorage).");
  };

  const handleReset = () => {
    reset();
    setLocal({
      provider: "openrouter",
      apiKey: "",
      model: "nousresearch/hermes-3-llama-3.1-8b",
      webSearchApiKey: "",
    });
    toast.info("Configurações restauradas.");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-sm font-semibold tracking-tight">Configurações</h1>
        <p className="text-xs text-muted-foreground">
          Credenciais armazenadas localmente no seu navegador. Nada é enviado a servidores.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="rounded-xl border border-border bg-surface-1 p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Provedor de IA</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Provedor</label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "openrouter", label: "OpenRouter", sub: "Dolphin / Hermes Uncensored" },
                      { id: "groq", label: "GroqCloud", sub: "Inferência ultrarrápida" },
                    ] as { id: AIProvider; label: string; sub: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setLocal({ ...local, provider: opt.id })}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        local.provider === opt.id
                          ? "border-primary/60 bg-primary/10 glow-cyber"
                          : "border-border bg-surface-2 hover:border-primary/30",
                      )}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <SecretField
                label="Chave de API do Provedor"
                value={local.apiKey}
                onChange={(v) => setLocal({ ...local, apiKey: v })}
                placeholder={local.provider === "groq" ? "gsk_..." : "sk-or-v1-..."}
                hint={
                  local.provider === "groq"
                    ? "Obtenha em console.groq.com/keys"
                    : "Obtenha em openrouter.ai/keys"
                }
              />

              <ModelPicker
                provider={local.provider}
                apiKey={local.apiKey}
                value={local.model}
                onChange={(id) => setLocal({ ...local, model: id })}
              />

              <details className="rounded-md border border-border bg-surface-2 p-2">
                <summary className="cursor-pointer text-[10px] text-muted-foreground">Colar ID manualmente</summary>
                <div className="mt-2">
                  <TextField
                    label=""
                    value={local.model}
                    onChange={(v) => setLocal({ ...local, model: v })}
                    placeholder="ex: deepseek/deepseek-r1:free"
                  />
                </div>
              </details>
            </div>
          </section>


          <section className="rounded-xl border border-border bg-surface-1 p-5">
            <h2 className="mb-4 text-sm font-semibold">Pesquisa Web</h2>
            <SecretField
              label="Chave de API do Buscador (Tavily / Serper)"
              value={local.webSearchApiKey}
              onChange={(v) => setLocal({ ...local, webSearchApiKey: v })}
              placeholder="tvly-... ou serper key"
              hint="Necessária quando o ícone do globo estiver ativo no input."
            />
          </section>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-surface-3"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar padrão
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 glow-cyber"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar configurações
            </button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            As chaves são lidas diretamente do <span className="font-mono text-primary">localStorage</span> (jarvis_api_key, jarvis_model, jarvis_search_key, jarvis_provider) por <span className="font-mono text-primary">src/lib/ai-clients.ts</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
