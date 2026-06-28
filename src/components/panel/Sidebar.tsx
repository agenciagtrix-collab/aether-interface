import { MessageSquare, Bot, History, Database, Settings as Cog, Zap } from "lucide-react";
import { usePanel, type PanelTab } from "./PanelContext";
import { ConnectionStatus } from "./ConnectionStatus";
import { cn } from "@/lib/utils";

const NAV: { id: PanelTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat Principal", icon: MessageSquare },
  { id: "agents", label: "Gerenciador de Agentes", icon: Bot },
  { id: "history", label: "Histórico de Tarefas", icon: History },
  { id: "memory", label: "Banco de Memória (RAG)", icon: Database },
  { id: "settings", label: "Configurações", icon: Cog },
];

export function Sidebar() {
  const { activeTab, setActiveTab } = usePanel();

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary glow-cyber">
          <Zap className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Autonomous AI</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Control Panel
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active &&
                    "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--cyber)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-sidebar-border p-3">
        <ConnectionStatus />
      </div>
    </nav>
  );
}
