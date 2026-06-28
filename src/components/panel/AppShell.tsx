import { Sidebar } from "./Sidebar";
import { ChatView } from "./ChatView";
import { ThinkingTerminal } from "./ThinkingTerminal";
import { AgentsManager } from "./views/AgentsManager";
import { TaskHistory } from "./views/TaskHistory";
import { MemoryBank } from "./views/MemoryBank";
import { SettingsView } from "./views/Settings";
import { usePanel } from "./PanelContext";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { activeTab, mode } = usePanel();
  const showTerminal = activeTab === "chat" && mode === "agent";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        <section
          className={cn(
            "flex flex-1 flex-col overflow-hidden transition-all duration-500 ease-out",
          )}
        >
          {activeTab === "chat" && <ChatView />}
          {activeTab === "agents" && <AgentsManager />}
          {activeTab === "history" && <TaskHistory />}
          {activeTab === "memory" && <MemoryBank />}
          {activeTab === "settings" && <SettingsView />}
        </section>

        <aside
          className={cn(
            "border-l border-border bg-surface-1 overflow-hidden transition-all duration-500 ease-out",
            showTerminal ? "w-[420px] opacity-100" : "w-0 opacity-0",
          )}
          aria-hidden={!showTerminal}
        >
          {showTerminal && <ThinkingTerminal />}
        </aside>
      </main>
    </div>
  );
}
