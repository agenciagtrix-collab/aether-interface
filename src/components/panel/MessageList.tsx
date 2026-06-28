import { useEffect, useRef, useState } from "react";
import { Bot, User, Sparkles, Paperclip, Brain, ChevronDown, Unlock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePanel } from "./PanelContext";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

interface MessageListProps {
  onResendUncensored?: (assistantId: string) => void;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
    </span>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="mb-2 rounded-lg border border-border bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Brain className="h-3 w-3 text-primary" />
        <span className="uppercase tracking-wider">Raciocínio</span>
        <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap border-t border-border px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {text}
        </pre>
      )}
    </div>
  );
}

function MarkdownMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          pre: ({ children }) => <>{children}</>,
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
            return (
              <code className={cn("rounded bg-background/60 px-1 py-0.5 font-mono text-[0.86em]", className)}>
                {children}
              </code>
            );
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-primary caret-blink" />
      )}
    </div>
  );
}

export function MessageList({ onResendUncensored }: MessageListProps = {}) {
  const { messages, mode, isRunning, statusText } = usePanel();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning, statusText]);

  if (messages.length === 0 && !isRunning) {
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
              ? "Defina uma missão. O agente decompõe em etapas e mostra o raciocínio no terminal à direita."
              : "Faça uma pergunta direta. Use o modo Agente para tarefas multi-etapas com pesquisa web."}
          </p>
        </div>
      </div>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const showTypingPlaceholder =
    isRunning && (!lastMsg || lastMsg.role === "user");

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
              {m.role === "assistant" && m.thinking && <ThinkingBlock text={m.thinking} />}

              {m.content ? (
                m.role === "assistant" ? (
                  <MarkdownMessage content={m.content} streaming={m.streaming} />
                ) : (
                  <p className="whitespace-pre-wrap">
                    {m.content}
                    {m.streaming && (
                      <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-primary caret-blink" />
                    )}
                  </p>
                )
              ) : m.streaming ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Brain className="h-3.5 w-3.5 text-primary animate-pulse" />
                  pensando <TypingDots />
                </span>
              ) : null}

              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.attachments.map((f) => (
                    <span
                      key={f.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]",
                        m.role === "user"
                          ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
                          : "border-border bg-background/40 text-muted-foreground",
                      )}
                      title={f.summary}
                    >
                      <Paperclip className="h-3 w-3" />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}

              {m.mode === "agent" && m.role === "assistant" && m.content && (
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> resposta do agente
                </span>
              )}
            </div>
          </div>
        ))}

        {showTypingPlaceholder && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-3.5 w-3.5 text-primary animate-pulse" />
                {statusText || (mode === "agent" ? "Agente raciocinando" : "Pensando")}
                <TypingDots />
              </span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
