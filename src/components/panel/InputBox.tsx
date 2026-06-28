import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Globe, Paperclip, SendHorizonal, X, FileText, FileArchive, Image as ImageIcon, FileQuestion, AlertCircle } from "lucide-react";
import { usePanel } from "./PanelContext";
import { cn } from "@/lib/utils";
import { readAttachment, formatFileSize } from "@/lib/file-readers";
import type { AttachedFile } from "./PanelContext";

interface Props {
  onSubmit: (text: string) => void;
}

interface ReadingItem {
  id: string;
  name: string;
  size: number;
  phase: string;
  loaded: number;
  total: number;
}

function kindIcon(kind: AttachedFile["kind"]) {
  switch (kind) {
    case "text": return <FileText className="h-3.5 w-3.5 text-sky-400" />;
    case "archive": return <FileArchive className="h-3.5 w-3.5 text-amber-400" />;
    case "image": return <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />;
    case "error": return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return <FileQuestion className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function InputBox({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [reading, setReading] = useState<ReadingItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    mode,
    webSearchEnabled,
    toggleWebSearch,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
    isRunning,
    pendingPrompt,
    setPendingPrompt,
  } = usePanel();

  // Aceita prompts injetados por painéis externos (Templates de Auditoria, etc.)
  useEffect(() => {
    if (!pendingPrompt) return;
    setValue(pendingPrompt);
    setPendingPrompt(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [pendingPrompt, setPendingPrompt]);

  const isReadingFiles = reading.length > 0;

  const placeholder =
    mode === "agent"
      ? "Defina a missão que o agente deve executar..."
      : "Envie uma mensagem...";

  const submit = () => {
    const t = value.trim() || (attachedFiles.length > 0 ? "Analise os arquivos anexados." : "");
    if (!t || isRunning || isReadingFiles) return;
    onSubmit(t);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const items: ReadingItem[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      phase: "Aguardando",
      loaded: 0,
      total: 1,
    }));
    setReading((prev) => [...prev, ...items]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const id = items[i].id;
        const parsed = await readAttachment(file, ({ phase, loaded, total }) => {
          setReading((prev) => prev.map((r) => (r.id === id ? { ...r, phase, loaded, total } : r)));
        });
        addAttachedFile(parsed);
        setReading((prev) => prev.filter((r) => r.id !== id));
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-t border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        {/* Progresso de leitura */}
        {reading.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {reading.map((r) => {
              const pct = Math.min(100, Math.round((r.loaded / Math.max(1, r.total)) * 100));
              return (
                <div key={r.id} className="rounded-md border border-border bg-surface-2 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="shrink-0 text-muted-foreground">{formatFileSize(r.size)} · {r.phase}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pré-visualização de anexos */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{attachedFiles.length} anexo(s) prontos para envio</span>
              <button
                onClick={clearAttachedFiles}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3 w-3" /> limpar tudo
              </button>
            </div>
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2"
              >
                {f.kind === "image" && f.dataUrl ? (
                  <img src={f.dataUrl} alt={f.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-3">
                    {kindIcon(f.kind)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{f.name}</p>
                    <button
                      onClick={() => removeAttachedFile(f.id)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                      aria-label="Remover anexo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {(f.type || f.kind)} · {formatFileSize(f.size)}
                    {f.content && ` · ${f.content.length.toLocaleString()} chars extraídos`}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">{f.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "group relative rounded-2xl border bg-surface-1 transition-all",
            "border-border focus-within:border-primary/60 focus-within:glow-cyber",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onInput={onInput}
            placeholder={placeholder}
            rows={1}
            className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-12 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleWebSearch}
                title="Pesquisa Web em Tempo Real"
                aria-label="Alternar pesquisa web"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                  webSearchEnabled
                    ? "border-primary/60 bg-primary/15 text-primary glow-cyber"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                <Globe className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isReadingFiles}
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Paperclip className={cn("h-4 w-4", isReadingFiles && "animate-pulse")} />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => onFiles(e.target.files)}
              />

              {webSearchEnabled && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-primary animate-fade-in">
                  web ativo
                </span>
              )}
              {isReadingFiles && (
                <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground animate-pulse">
                  lendo {reading.length} arquivo(s)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={(!value.trim() && attachedFiles.length === 0) || isRunning || isReadingFiles}
              aria-label="Enviar mensagem"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
                "bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <SendHorizonal className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {mode === "agent"
            ? "Enter envia · Shift+Enter quebra linha · raciocínio ao vivo no terminal"
            : "Enter envia · Shift+Enter quebra linha"}
        </p>
      </div>
    </div>
  );
}
