import { CheckCircle2, Clock, XCircle } from "lucide-react";

const MOCK = [
  { id: "tsk_001", title: "Pesquisar tendências de IA em 2026", status: "done", duration: "14s", at: "há 2 min" },
  { id: "tsk_002", title: "Resumir 5 PDFs anexados", status: "done", duration: "42s", at: "há 18 min" },
  { id: "tsk_003", title: "Gerar relatório de mercado SaaS", status: "running", duration: "—", at: "agora" },
  { id: "tsk_004", title: "Comparar APIs de embeddings", status: "error", duration: "8s", at: "ontem" },
];

export function TaskHistory() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-sm font-semibold tracking-tight">Histórico de Tarefas</h1>
        <p className="text-xs text-muted-foreground">Auditoria de execuções do agente.</p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface-1">
          {MOCK.map((t) => {
            const Icon = t.status === "done" ? CheckCircle2 : t.status === "error" ? XCircle : Clock;
            const color =
              t.status === "done"
                ? "text-[var(--status-online)]"
                : t.status === "error"
                  ? "text-[var(--status-offline)]"
                  : "text-primary";
            return (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className="flex-1">
                  <p className="text-sm">{t.title}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{t.id}</p>
                </div>
                <span className="text-xs text-muted-foreground">{t.duration}</span>
                <span className="text-xs text-muted-foreground w-20 text-right">{t.at}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
