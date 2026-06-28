import { useState } from "react";
import {
  Bot,
  Files,
  History,
  MessageSquare,
  Database,
  Settings as SettingsIcon,
} from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { FileExplorer } from "./FileExplorer";
import { EditorArea } from "./EditorArea";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { ChatView } from "@/components/panel/ChatView";
import { ThinkingTerminal } from "@/components/panel/ThinkingTerminal";
import { AgentsManager } from "@/components/panel/views/AgentsManager";
import { TaskHistory } from "@/components/panel/views/TaskHistory";
import { MemoryBank } from "@/components/panel/views/MemoryBank";
import { SettingsView } from "@/components/panel/views/Settings";
import { usePanel } from "@/components/panel/PanelContext";
import { cn } from "@/lib/utils";

type ActivityView = "explorer" | "chat" | "agents" | "history" | "memory" | "settings";

const ACTIVITY_ITEMS: { id: ActivityView; label: string; icon: typeof Files }[] = [
  { id: "explorer", label: "Explorador", icon: Files },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "agents", label: "Agentes", icon: Bot },
  { id: "history", label: "Histórico", icon: History },
  { id: "memory", label: "Memória", icon: Database },
  { id: "settings", label: "Configurações", icon: SettingsIcon },
];

function ActivityBar({
  active,
  onSelect,
}: {
  active: ActivityView;
  onSelect: (v: ActivityView) => void;
}) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-1 py-2">
      {ACTIVITY_ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            title={label}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
              isActive && "text-foreground",
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
            )}
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}

function SidebarPanel({ view }: { view: ActivityView }) {
  if (view === "explorer") return <FileExplorer />;
  if (view === "agents") return <AgentsManager />;
  if (view === "history") return <TaskHistory />;
  if (view === "memory") return <MemoryBank />;
  if (view === "settings") return <SettingsView />;
  // chat tem coluna própria à direita
  return (
    <div className="p-4 text-xs text-muted-foreground">
      Use o painel de chat à direita.
    </div>
  );
}

function StatusBar() {
  const { rootName, tabs, activeTabPath, supportsWrite } = useWorkspace();
  const active = tabs.find((t) => t.path === activeTabPath);
  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-primary/10 px-3 font-mono text-[10px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{rootName ?? "sem workspace"}</span>
        {active && <span>{active.language}</span>}
        {active?.dirty && <span className="text-primary">● não salvo</span>}
      </div>
      <div className="flex items-center gap-3">
        <span>{supportsWrite ? "FS: leitura/escrita" : "FS: somente leitura"}</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}

function IdeShellInner() {
  const [view, setView] = useState<ActivityView>("explorer");
  const { mode } = usePanel();
  const showTerminal = mode === "agent";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar active={view} onSelect={setView} />

        <PanelGroup orientation="horizontal" className="flex h-full min-w-0 flex-1">
          {/* Sidebar */}
          <Panel defaultSize={18} minSize={10} maxSize={40} className="bg-surface-1">
            <div className="flex h-full w-full min-w-0 overflow-hidden">
              <SidebarPanel view={view} />
            </div>
          </Panel>
          <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

          {/* Editor + bottom terminal */}
          <Panel defaultSize={52} minSize={20}>
            <PanelGroup orientation="vertical" className="h-full w-full">
              <Panel defaultSize={showTerminal ? 70 : 100} minSize={20}>
                <div className="h-full w-full min-w-0 overflow-hidden">
                  <EditorArea />
                </div>
              </Panel>
              {showTerminal && (
                <>
                  <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-primary/50" />
                  <Panel defaultSize={30} minSize={10} className="bg-surface-1">
                    <div className="h-full w-full min-w-0 overflow-hidden">
                      <ThinkingTerminal />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/50" />

          {/* Chat panel */}
          <Panel defaultSize={30} minSize={18} maxSize={50} className="bg-surface-1">
            <div className="flex h-full w-full min-w-0 overflow-hidden">
              <ChatView />
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <StatusBar />
    </div>
  );
}

export function IdeShell() {
  return (
    <WorkspaceProvider>
      <IdeShellInner />
    </WorkspaceProvider>
  );
}
