import { useState } from "react";
import { Eye, EyeOff, Save, RotateCcw, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useSettings, type AIProvider } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

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

              <TextField
                label="Modelo de IA Customizado"
                value={local.model}
                onChange={(v) => setLocal({ ...local, model: v })}
                placeholder="nousresearch/hermes-3-llama-3.1-8b"
                hint="Ex.: nousresearch/hermes-3-llama-3.1-8b · cognitivecomputations/dolphin-mixtral-8x7b · llama-3.3-70b-versatile"
              />
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
            Para chamadas reais, abra <span className="font-mono text-primary">src/lib/ai-clients.ts</span> e descomente as funções de fetch.
          </p>
        </div>
      </div>
    </div>
  );
}
