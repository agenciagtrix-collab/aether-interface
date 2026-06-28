import { FileText, Upload } from "lucide-react";

const MOCK = [
  { name: "documentacao-interna.pdf", size: "1.4 MB", chunks: 128 },
  { name: "transcricao-reuniao.md", size: "44 KB", chunks: 12 },
  { name: "base-conhecimento.json", size: "320 KB", chunks: 87 },
];

export function MemoryBank() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Banco de Memória (RAG)</h1>
          <p className="text-xs text-muted-foreground">Documentos indexados disponíveis para o agente.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-surface-3">
          <Upload className="h-3.5 w-3.5" /> Indexar documento
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-2">
          {MOCK.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.size} · {d.chunks} chunks
                </p>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                indexed
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
