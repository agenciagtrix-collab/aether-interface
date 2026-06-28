import { useEffect, useRef } from "react";
import { Bot, User, Sparkles } from "lucide-react";
import { usePanel } from "./PanelContext";
import { cn } from "@/lib/utils";

export function MessageList() {
  const { messages, mode, isRunning } = usePanel();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 glow-cyber">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-glow">
            {mode === "agent" ? "Pronto para executar missões" : "Inicie uma conversa"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "agent"
              ? "Defina uma missão complexa abaixo. O agente decompõe em etapas e mostra o raciocínio em tempo real no terminal à direita."
              : "Faça uma pergunta direta. Use o modo Agente para tarefas multi-etapas com pesquisa web."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3 animate-fade-in",
              m.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border",
                m.role === "user"
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-2 text-foreground",
              )}
            >
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-foreground border border-border",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.mode === "agent" && m.role === "assistant" && (
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> resposta do agente
                </span>
              )}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {mode === "agent" ? "Agente executando missão..." : "Gerando resposta..."}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
