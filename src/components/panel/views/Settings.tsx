import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Save, RotateCcw, KeyRound, RefreshCw, Search, Check, Flame, AlertTriangle, Zap, Bot, Unlock, Rocket, Info } from "lucide-react";
import { toast } from "sonner";
import { useSettings, type AIProvider } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface ModelOption {
  id: string;
  label: string;
  contextK?: number;
  isFree?: boolean;
  isUncensored?: boolean;
  provider?: string;
}

const CACHE_KEY = "jarvis_models_cache_v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h

// Heurística: famílias/keywords conhecidas como uncensored/abliterated/roleplay-friendly
const UNCENSORED_PATTERNS = [
  "dolphin", "venice", "abliterat", "uncensored", "hermes", "nous", "wizardlm", "wizard-lm",
  "mythomax", "noromaid", "airoboros", "lumimaid", "magnum", "rocinante", "stheno",
  "openhermes", "spicy", "neuralhermes", "midnight", "fimbulvetr",
];

// Modelos free populares em famílias problemáticas (heurística simples)
const RATE_LIMITED_HINTS = ["venice", "openrouter/auto"];

function classifyModel(id: string, label: string): { isUncensored: boolean; mayRateLimit: boolean } {
  const lower = (id + " " + label).toLowerCase();
  return {
    isUncensored: UNCENSORED_PATTERNS.some((p) => lower.includes(p)),
    mayRateLimit: lower.includes(":free") && RATE_LIMITED_HINTS.some((p) => lower.includes(p)),
  };
}

interface QuickPreset {
  id: string;
  icon: typeof Bot;
  label: string;
  tooltip: string;
  primaryId: string;
  highlightIds: string[];
  filterQuery: string;
  accent: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "advanced",
    icon: Bot,
    label: "🤖 Uso Geral Avançado (Hermes 405B)",
    tooltip: "Ideal para o Modo Agente, tarefas ultra complexas, lógica avançada e programação de códigos pesados.",
    primaryId: "nousresearch/hermes-3-llama-3.1-405b",
    highlightIds: ["nousresearch/hermes-3-llama-3.1-405b"],
    filterQuery: "hermes",
    accent: "from-sky-500/20 to-indigo-500/20 border-sky-500/40 text-sky-300",
  },
  {
    id: "uncensored",
    icon: Unlock,
    label: "🔓 Liberdade Total Sem Censura (Venice/Magnum)",
    tooltip: "Ideal para qualquer pergunta sem filtros éticos ou morais, escrita criativa sem travas.",
    primaryId: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    highlightIds: [
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
      "anthracite-org/magnum-v4-72b",
    ],
    filterQuery: "venice",
    accent: "from-orange-500/20 to-rose-500/20 border-orange-500/40 text-orange-300",
  },
  {
    id: "fast",
    icon: Rocket,
    label: "⚡ Respostas Ultra Rápidas (Modelos menores 8B/13B)",
    tooltip: "Perfeito para conversas rápidas do dia a dia, gastando o mínimo possível de processamento e créditos.",
    primaryId: "gryphe/mythomax-l2-13b",
    highlightIds: ["gryphe/mythomax-l2-13b"],
    filterQuery: "mythomax",
    accent: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300",
  },
];

// Descrições dinâmicas exibidas abaixo do modelo selecionado
const MODEL_DESCRIPTIONS: { match: RegExp; text: string }[] = [
  { match: /hermes-3-llama-3\.1-405b/i, text: "Recomendado para o Modo Agente, raciocínio profundo, programação complexa e tarefas que exigem 405B de parâmetros." },
  { match: /hermes/i, text: "Família Hermes/Nous: ótimo equilíbrio entre seguir instruções e responder sem travas excessivas." },
  { match: /venice|dolphin/i, text: "Recomendado para conversas totalmente livres, sem filtros morais/éticos, e escrita criativa sem censura." },
  { match: /magnum/i, text: "Magnum v4 72B: especialista em roleplay imersivo, prosa criativa e diálogo natural sem censura." },
  { match: /mythomax/i, text: "Recomendado para RPG, conversas longas e histórias sem censura. Leve, rápido e barato." },
  { match: /deepseek-r1|qwq/i, text: "Modelo com raciocínio nativo — você verá o passo a passo do pensamento antes da resposta final." },
  { match: /deepseek/i, text: "DeepSeek: excelente em código, matemática e raciocínio lógico. Custo-benefício alto." },
  { match: /gpt-4o|claude|gemini/i, text: "Modelo premium multimodal — suporta visão (imagens) e tem alta capacidade geral." },
  { match: /llama-3\.1-8b|llama-3-8b|8b/i, text: "Modelo leve 8B: respostas rápidas, ideal para chat do dia a dia com baixo consumo." },
  { match: /:free/i, text: "Modelo gratuito — pode ter limites de rate. Em caso de erro 429, tente outro :free." },
];

function describeModel(id: string): string | null {
  if (!id) return null;
  const hit = MODEL_DESCRIPTIONS.find((d) => d.match.test(id));
  return hit?.text ?? null;
}



async function fetchModels(provider: AIProvider, apiKey: string): Promise<ModelOption[]> {
  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    return (data?.data ?? []).map((m: any) => {
      const id = String(m.id);
      const label = String(m.name ?? id);
      const c = classifyModel(id, label);
      return {
        id,
        label,
        contextK: m.context_length ? Math.round(Number(m.context_length) / 1000) : undefined,
        isFree: id.includes(":free") || m.pricing?.prompt === "0",
        isUncensored: c.isUncensored,
        provider: String(m.id.split("/")[0] ?? ""),
      } as ModelOption;
    });
  }
  if (!apiKey) throw new Error("Cole a chave Groq antes de listar modelos.");
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return (data?.data ?? []).map((m: any) => {
    const id = String(m.id);
    const c = classifyModel(id, id);
    return {
      id,
      label: id,
      contextK: m.context_window ? Math.round(Number(m.context_window) / 1000) : undefined,
      isFree: true,
      isUncensored: c.isUncensored,
    } as ModelOption;
  });
}

function readCache(provider: AIProvider): { list: ModelOption[]; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY}_${provider}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.list)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(provider: AIProvider, list: ModelOption[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CACHE_KEY}_${provider}`,
      JSON.stringify({ list, ts: Date.now() }),
    );
  } catch {
    // ignora quota
  }
}

function sortModels(list: ModelOption[]): ModelOption[] {
  // uncensored primeiro, free segundo, depois alfabético
  return [...list].sort((a, b) => {
    if (a.isUncensored !== b.isUncensored) return a.isUncensored ? -1 : 1;
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
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
  const [cacheTs, setCacheTs] = useState<number | null>(null);
  const [onlyUncensored, setOnlyUncensored] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);

  const load = async (opts: { force?: boolean } = {}) => {
    setError(null);
    // tenta cache primeiro (a menos que force)
    if (!opts.force) {
      const cached = readCache(provider);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setModels(sortModels(cached.list));
        setCacheTs(cached.ts);
        return;
      }
    }
    setLoading(true);
    try {
      const list = await fetchModels(provider, apiKey);
      const sorted = sortModels(list);
      setModels(sorted);
      writeCache(provider, list);
      setCacheTs(Date.now());
      if (opts.force) toast.success(`${list.length} modelos atualizados.`);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar modelos");
      // se falhou, tenta usar cache antigo como fallback
      const cached = readCache(provider);
      if (cached) {
        setModels(sortModels(cached.list));
        setCacheTs(cached.ts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider === "openrouter") void load();
    else {
      const cached = readCache(provider);
      if (cached) {
        setModels(sortModels(cached.list));
        setCacheTs(cached.ts);
      } else {
        setModels([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (onlyUncensored && !m.isUncensored) return false;
      if (onlyFree && !m.isFree) return false;
      if (!q) return true;
      return m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q);
    });
  }, [query, models, onlyUncensored, onlyFree]);

  const uncensoredCount = models.filter((m) => m.isUncensored).length;
  const cacheAgeMin = cacheTs ? Math.floor((Date.now() - cacheTs) / 60000) : null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium">
          Modelo <span className="text-muted-foreground">({models.length} total · {uncensoredCount} uncensored)</span>
        </label>
        <button
          type="button"
          onClick={() => load({ force: true })}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] hover:bg-surface-3 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOnlyUncensored((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors",
            onlyUncensored ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface-2 hover:bg-surface-3",
          )}
        >
          <Flame className="h-3 w-3" /> Uncensored
        </button>
        <button
          type="button"
          onClick={() => setOnlyFree((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors",
            onlyFree ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface-2 hover:bg-surface-3",
          )}
        >
          Free
        </button>
        {cacheAgeMin !== null && (
          <span className="ml-auto text-[9px] text-muted-foreground">
            Cache: {cacheAgeMin === 0 ? "agora" : `${cacheAgeMin} min atrás`}
          </span>
        )}
      </div>

      {/* Filtros Rápidos por Objetivo */}
      <div className="mb-3 rounded-lg border border-border bg-gradient-to-br from-surface-2 to-surface-1 p-2.5">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Info className="h-3 w-3" /> Filtros rápidos por objetivo — escolha em 1 clique
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {QUICK_PRESETS.map((p) => {
            const Icon = p.icon;
            const active = p.highlightIds.includes(value);
            return (
              <button
                key={p.id}
                type="button"
                title={p.tooltip}
                onClick={() => {
                  setQuery(p.filterQuery);
                  onChange(p.primaryId);
                  toast.success(`Preset aplicado: ${p.label}`);
                }}
                className={cn(
                  "group relative flex items-start gap-2 rounded-md border bg-gradient-to-br p-2 text-left text-[10px] transition-all hover:scale-[1.02] hover:shadow-lg",
                  p.accent,
                  active && "ring-2 ring-primary/60",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium leading-tight">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar (ex: dolphin, deepseek, llama, free)..."
          className="w-full rounded-md border border-input bg-surface-1 py-2 pl-8 pr-3 text-xs focus:border-primary/60 focus:outline-none"
        />
      </div>


      {error && (
        <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
          ⚠️ {error}
          {models.length > 0 && " — usando cache local."}
        </p>
      )}

      <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-surface-2">
        {filtered.length === 0 ? (
          <p className="p-3 text-center text-[10px] text-muted-foreground">
            {loading ? "Carregando..." : models.length === 0 ? "Clique em Atualizar." : "Nenhum modelo encontrado."}
          </p>
        ) : (
          filtered.slice(0, 300).map((m) => {
            const mayRateLimit = m.isFree && /venice|auto/i.test(m.id);
            const isPresetHighlighted = QUICK_PRESETS.some((p) => p.highlightIds.includes(m.id));
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(m.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-[11px] last:border-0 hover:bg-surface-3",
                  value === m.id && "bg-primary/10",
                  isPresetHighlighted && value !== m.id && "bg-amber-500/5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isPresetHighlighted && (
                      <span title="Recomendado por preset rápido">⭐</span>
                    )}
                    {m.isUncensored && <Flame className="h-3 w-3 shrink-0 text-orange-400" />}
                    <p className="truncate font-medium">{m.label}</p>
                  </div>
                  <p className="truncate font-mono text-[9px] text-muted-foreground">{m.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {m.isFree && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                      FREE
                    </span>
                  )}
                  {m.contextK && (
                    <span className="text-[9px] text-muted-foreground">{m.contextK}k</span>
                  )}
                  {mayRateLimit && (
                    <span title="Modelo free com histórico de rate-limit upstream">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    </span>
                  )}
                  {m.isUncensored && !mayRateLimit && (
                    <span title="Uncensored / Abliterated">
                      <Zap className="h-3 w-3 text-orange-400" />
                    </span>
                  )}
                  {value === m.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </button>
            );
          })
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Selecionado: <span className="font-mono text-primary">{value || "—"}</span>
      </p>
      {describeModel(value) && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[10px] text-primary/90">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{describeModel(value)}</span>
        </div>
      )}
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
      model: "deepseek/deepseek-chat-v3.1:free",
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

          <UncensoredModelSection />
          <CustomSystemPromptSection />
          <AutoApplySection />
          <DaemonSection />


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

function DaemonSection() {
  const [url, setUrl] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem("jarvis_daemon_url")) || "ws://localhost:17345",
  );
  const [token, setToken] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem("jarvis_daemon_token")) || "",
  );
  const save = () => {
    localStorage.setItem("jarvis_daemon_url", url.trim());
    localStorage.setItem("jarvis_daemon_token", token.trim());
    toast.success("Daemon configurado. Abra o painel Terminal Real na IDE.");
  };
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Daemon Local (Terminal Real)</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Permite execução real de comandos no seu computador, com autorização explícita por comando. Dois modos:
        <br />• <b>Electron</b>: empacote o app com <span className="font-mono">electron/main.cjs</span> — conecta automático.
        <br />• <b>Browser</b>: rode <span className="font-mono text-primary">node daemon/server.cjs</span> e preencha abaixo.
      </p>
      <div className="space-y-2">
        <label className="block text-xs font-medium">URL do Daemon (WebSocket)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://localhost:17345"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-primary/60"
        />
        <label className="block text-xs font-medium">Token</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="copie o token impresso no terminal do daemon"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-primary/60"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          Salvar
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-2 text-[10px] leading-relaxed text-muted-foreground">
{`# 1) instale uma vez
npm i ws

# 2) rode o daemon (anote URL + token impressos)
JARVIS_TOKEN=meutoken JARVIS_PORT=17345 \\
JARVIS_CWD=/caminho/do/projeto \\
node daemon/server.cjs`}
      </pre>
    </section>
  );
}


function AutoApplySection() {
  const [mode, setMode] = useState<"off" | "ask" | "always">(() => {
    if (typeof window === "undefined") return "off";
    const v = localStorage.getItem("jarvis_auto_apply_mode");
    if (v === "always" || v === "ask" || v === "off") return v;
    return localStorage.getItem("jarvis_auto_apply") === "1" ? "ask" : "off";
  });
  const update = (next: "off" | "ask" | "always") => {
    setMode(next);
    localStorage.setItem("jarvis_auto_apply_mode", next);
    localStorage.setItem("jarvis_auto_apply", next === "off" ? "0" : "1");
    toast.success(
      next === "always"
        ? "Auto-aplicar TOTAL ativado — sem perguntas"
        : next === "ask"
          ? "Auto-aplicar com confirmação ativado"
          : "Auto-aplicar desativado",
    );
  };
  const options: Array<{ id: "off" | "ask" | "always"; label: string; desc: string }> = [
    { id: "off", label: "Desativado", desc: "Você clica em 'Aplicar' em cada bloco." },
    { id: "ask", label: "Perguntar 1x por arquivo", desc: "Confirma antes de gravar — funciona em chat e agente." },
    { id: "always", label: "Sempre aplicar (sem perguntar)", desc: "Grava todo bloco com caminho automaticamente. Reverta no histórico se precisar." },
  ];
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold">Auto-aplicar edições</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Controla como blocos <span className="font-mono text-primary">```lang:caminho</span> são gravados no
        workspace. Edições ficam no histórico e podem ser revertidas.
      </p>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/40 p-3 hover:border-primary/50">
            <input
              type="radio"
              name="auto-apply-mode"
              checked={mode === o.id}
              onChange={() => update(o.id)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-xs font-medium">{o.label}</span>
              <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
        ⚠️ Execução de comandos de terminal (npm install, git, etc.) não roda direto no navegador
        por sandbox. A IA gera os comandos prontos para você colar no seu terminal local.
      </p>
    </section>
  );
}

function UncensoredModelSection() {
  const [value, setValue] = useState(
    () =>
      (typeof window !== "undefined" && localStorage.getItem("jarvis_uncensored_model")) ||
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
  );
  const save = () => {
    localStorage.setItem("jarvis_uncensored_model", value.trim());
    toast.success("Modelo uncensored salvo.");
  };
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Unlock className="h-4 w-4 text-orange-400" />
        <h2 className="text-sm font-semibold">Modelo Uncensored (botão de reenvio)</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Usado pelo botão <span className="font-mono text-orange-300">"Reenviar para Modelo Uncensored"</span> que
        aparece embaixo de cada resposta do chat. Você escolhe e controla qual modelo é acionado.
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ex: cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
          className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-primary/60"
        />
        <button
          onClick={save}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          Salvar
        </button>
      </div>
    </section>
  );
}

function CustomSystemPromptSection() {
  const [value, setValue] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem("jarvis_system_prompt")) || "",
  );
  const save = () => {
    localStorage.setItem("jarvis_system_prompt", value);
    toast.success("System prompt customizado salvo.");
  };
  const clear = () => {
    setValue("");
    localStorage.removeItem("jarvis_system_prompt");
    toast.info("System prompt customizado removido.");
  };
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">System Prompt Customizado do Agente</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Texto injetado no início de toda conversa, antes das instruções padrão. Use para definir tom, persona,
        idioma, restrições, ou instruções específicas do seu fluxo.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Ex: Você é um engenheiro sênior brasileiro, sempre responde em pt-BR, prefere TypeScript estrito..."
        className="w-full resize-y rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-primary/60"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface-3"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </button>
        <button
          onClick={save}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          Salvar prompt
        </button>
      </div>
    </section>
  );
}
