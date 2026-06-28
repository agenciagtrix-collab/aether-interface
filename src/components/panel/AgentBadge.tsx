import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AGENTS, ROUTABLE_AGENTS, type AgentId } from "@/lib/agents";
import { cn } from "@/lib/utils";

interface Props {
  active: AgentId;
  onChange: (id: AgentId) => void;
}

export function AgentBadge({ active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const agent = AGENTS[active];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
          agent.color,
        )}
        title={agent.description}
      >
        <span>{agent.emoji}</span>
        <span className="max-w-[140px] truncate">{agent.name}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="border-b border-border px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              IA ativa
            </div>
            {ROUTABLE_AGENTS.map((id) => {
              const a = AGENTS[id];
              const isActive = id === active;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-accent"
                >
                  <span className="text-base leading-none">{a.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      {a.name}
                      {isActive && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{a.description}</div>
                  </div>
                </button>
              );
            })}
            {active === "uncensored" && (
              <div className="border-t border-border bg-rose-500/5 px-2.5 py-1.5 text-[10px] text-rose-400">
                Modo Uncensored ativo · selecione um especialista acima para voltar à Lovable.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
