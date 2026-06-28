import { Bot, Plus } from "lucide-react";

const MOCK = [
  { name: "Pesquisador Web", desc: "Especialista em coletar e sintetizar informações da internet.", model: "hermes-3-llama-3.1-8b" },
  { name: "Analista de Código", desc: "Lê repositórios e propõe refatorações.", model: "llama-3.3-70b-versatile" },
  { name: "Redator Técnico", desc: "Transforma raciocínios em documentação clara.", model: "dolphin-mixtral-8x7b" },
];

export function AgentsManager() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Gerenciador de Agentes</h1>
          <p className="text-xs text-muted-foreground">Perfis reutilizáveis com prompts e modelos pré-definidos.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Novo agente
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {MOCK.map((a) => (
            <div
              key={a.name}
              className="rounded-xl border border-border bg-surface-1 p-4 transition-all hover:border-primary/40 hover:glow-cyber"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">{a.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
              <p className="mt-3 font-mono text-[10px] text-primary">{a.model}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
