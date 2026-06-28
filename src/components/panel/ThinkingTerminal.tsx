import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { usePanel } from "./PanelContext";
import { TerminalStepRow } from "./TerminalStep";

export function ThinkingTerminal() {
  const { terminalSteps, isRunning } = usePanel();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalSteps]);

  return (
    <div className="flex h-full flex-col bg-[var(--terminal-bg)]">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Pensamento do Agente
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
          <span
            className={
              isRunning
                ? "h-1.5 w-1.5 rounded-full bg-primary pulse-dot text-primary"
                : "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
            }
          />
          {isRunning ? "executando" : "ocioso"}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {terminalSteps.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center font-mono text-xs text-muted-foreground">
            <div>
              <p>$ aguardando missão...</p>
              <p className="mt-1 inline-flex items-center">
                <span className="h-3 w-1.5 bg-primary caret-blink" />
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {terminalSteps.map((s, i) => (
              <TerminalStepRow key={s.id} step={s} index={i} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
        <span className="text-primary">●</span> autonomous-agent v0.1 · execução real
      </footer>
    </div>
  );
}
