import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileCode2, GitCompare, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/ide/WorkspaceContext";
import { usePanel } from "@/components/panel/PanelContext";
import { cn } from "@/lib/utils";

const DiffEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.DiffEditor })),
);

/**
 * Detecta blocos ```lang:caminho/arquivo.ext e renderiza header
 * com Diff inline (Monaco) + botão "Aplicar". Auto-aplica quando
 * o usuário ativou em Configurações e está em modo Agente.
 */
export function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { adapter, applyEdit, supportsWrite } = useWorkspace();
  const { mode } = usePanel();
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const autoTriedRef = useRef(false);

  const meta = useMemo(() => {
    const raw = (className ?? "").replace(/^language-/, "");
    if (!raw) return { lang: "plaintext", path: null as string | null };
    const idx = raw.indexOf(":");
    if (idx === -1) return { lang: raw, path: null };
    return { lang: raw.slice(0, idx) || "plaintext", path: raw.slice(idx + 1).trim() || null };
  }, [className]);

  const code = useMemo(() => {
    const collect = (n: React.ReactNode): string => {
      if (n == null || typeof n === "boolean") return "";
      if (typeof n === "string" || typeof n === "number") return String(n);
      if (Array.isArray(n)) return n.map(collect).join("");
      if (typeof n === "object" && "props" in (n as object)) {
        return collect((n as { props: { children?: React.ReactNode } }).props.children);
      }
      return "";
    };
    return collect(children).replace(/\n$/, "");
  }, [children]);

  // Carrega conteúdo anterior do disco quando o usuário abre o diff
  useEffect(() => {
    if (!showDiff || !adapter || !meta.path || previous !== null) return;
    let cancel = false;
    adapter
      .readText(meta.path)
      .then((txt) => !cancel && setPrevious(txt))
      .catch(() => !cancel && setPrevious(""));
    return () => {
      cancel = true;
    };
  }, [showDiff, adapter, meta.path, previous]);

  const doApply = async () => {
    if (!meta.path) return;
    if (!adapter) {
      toast.error("Abra uma pasta de trabalho na IDE primeiro.");
      return;
    }
    if (!supportsWrite) {
      toast.error("Use Chrome/Edge com pasta aberta nativamente para aplicar mudanças.");
      return;
    }
    setBusy(true);
    const result = await applyEdit(meta.path, code);
    setBusy(false);
    if (result) setApplied(true);
  };

  // Auto-apply opcional — funciona em chat e agente
  useEffect(() => {
    if (autoTriedRef.current || applied || !meta.path || !adapter || !supportsWrite) return;
    if (typeof window === "undefined") return;
    const mode =
      localStorage.getItem("jarvis_auto_apply_mode") ??
      (localStorage.getItem("jarvis_auto_apply") === "1" ? "ask" : "off");
    if (mode === "off") return;
    autoTriedRef.current = true;
    if (mode === "always") {
      void doApply();
    } else {
      const ok = window.confirm(`Aplicar edição em "${meta.path}"?`);
      if (ok) void doApply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, meta.path, adapter, supportsWrite, applied]);

  const doCreateAtPrompt = async () => {
    if (!adapter) {
      toast.error("Abra uma pasta de trabalho na IDE primeiro.");
      return;
    }
    if (!supportsWrite) {
      toast.error("Use Chrome/Edge com pasta aberta nativamente para gravar arquivos.");
      return;
    }
    const guessExt =
      meta.lang && meta.lang !== "plaintext"
        ? `.${meta.lang.replace(/[^a-z0-9]/gi, "") || "txt"}`
        : ".txt";
    const suggested = `novo-arquivo${guessExt}`;
    const path = window.prompt("Caminho do arquivo a criar (relativo à raiz do workspace):", suggested);
    if (!path) return;
    setBusy(true);
    const result = await applyEdit(path.trim(), code);
    setBusy(false);
    if (result) setApplied(true);
  };

  if (!meta.path) {
    return (
      <div className="my-3 overflow-hidden rounded-lg border border-border bg-background/70">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px]">
          <span className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground">
            <FileCode2 className="h-3 w-3 shrink-0 text-primary" />
            <span className="rounded bg-background/60 px-1 py-px text-[9px] uppercase tracking-wider">
              {meta.lang}
            </span>
          </span>
          <button
            type="button"
            onClick={doCreateAtPrompt}
            disabled={busy || applied}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition-colors",
              applied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25",
              (busy || applied) && "cursor-not-allowed opacity-80",
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : applied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {applied ? "Aplicado" : busy ? "Criando..." : "Aplicar ao Workspace"}
          </button>
        </div>
        <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed">
          <code className={cn("font-mono", className)}>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-background/70">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground">
          <FileCode2 className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{meta.path}</span>
          <span className="ml-1 rounded bg-background/60 px-1 py-px text-[9px] uppercase tracking-wider">
            {meta.lang}
          </span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDiff((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition-colors",
              showDiff
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <GitCompare className="h-3 w-3" />
            {showDiff ? "Ocultar diff" : "Ver diff"}
          </button>
          <button
            type="button"
            onClick={doApply}
            disabled={busy || applied}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition-colors",
              applied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25",
              (busy || applied) && "cursor-not-allowed opacity-80",
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : applied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {applied ? "Aplicado" : busy ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>

      {showDiff ? (
        <div className="h-[320px] w-full bg-[#1e1e1e]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Carregando diff...
              </div>
            }
          >
            <DiffEditor
              original={previous ?? ""}
              modified={code}
              language={meta.lang}
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
              }}
            />
          </Suspense>
        </div>
      ) : (
        <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed">
          <code className={cn("font-mono", className)}>{code}</code>
        </pre>
      )}
    </div>
  );
}
