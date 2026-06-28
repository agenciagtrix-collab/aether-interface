import { useMemo, useState } from "react";
import { FileCode2, History, Loader2, RotateCcw } from "lucide-react";
import { useWorkspace, type FileEdit } from "@/components/ide/WorkspaceContext";

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "agora";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} h`;
  return new Date(ts).toLocaleString();
}

function EditRow({ edit }: { edit: FileEdit }) {
  const { revertEdit } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const isNew = edit.previousContent === null;

  const handleRevert = async () => {
    setBusy(true);
    await revertEdit(edit.id);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <FileCode2
        className={`h-4 w-4 ${edit.reverted ? "text-muted-foreground" : "text-primary"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-mono">{edit.path}</p>
        <p className="text-[10px] text-muted-foreground">
          {isNew ? "Criado" : "Modificado"} • {formatTime(edit.timestamp)}
          {edit.reverted ? " • revertido" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={handleRevert}
        disabled={busy || edit.reverted}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        {edit.reverted ? "Revertido" : "Reverter"}
      </button>
    </div>
  );
}

export function TaskHistory() {
  const { edits } = useWorkspace();
  const ordered = useMemo(() => [...edits].sort((a, b) => b.timestamp - a.timestamp), [edits]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h1 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <History className="h-4 w-4 text-primary" />
          Edições do Agente
        </h1>
        <p className="text-xs text-muted-foreground">
          Histórico de mudanças aplicadas pelo agente nos arquivos do workspace. Reverter restaura
          o conteúdo anterior no disco.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {ordered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-1 p-10 text-center text-xs text-muted-foreground">
              Nenhuma edição registrada ainda. Quando o agente aplicar mudanças via blocos de
              código <span className="font-mono text-primary">```lang:caminho</span>, elas
              aparecerão aqui.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-surface-1">
              {ordered.map((e) => (
                <EditRow key={e.id} edit={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
