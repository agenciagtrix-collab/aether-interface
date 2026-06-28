import { useRef, useState, type KeyboardEvent } from "react";
import { Globe, Paperclip, SendHorizonal, X } from "lucide-react";
import { usePanel } from "./PanelContext";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (text: string) => void;
}

export function InputBox({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    mode,
    webSearchEnabled,
    toggleWebSearch,
    attachedFiles,
    addAttachedFile,
    clearAttachedFiles,
    isRunning,
  } = usePanel();

  const placeholder =
    mode === "agent"
      ? "Defina a missão que o agente deve executar..."
      : "Envie uma mensagem...";

  const submit = () => {
    const t = value.trim();
    if (!t || isRunning) return;
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

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => addAttachedFile(f.name));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-t border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                {f}
              </span>
            ))}
            <button
              onClick={clearAttachedFiles}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Remover anexos"
            >
              <X className="h-3 w-3" />
              limpar
            </button>
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
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-2"
              >
                <Paperclip className="h-4 w-4" />
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
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!value.trim() || isRunning}
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
