import { useState } from "react";
import {
  Bot,
  Files,
  GripHorizontal,
  GripVertical,
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

function ResizeHandle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const isHorizontal = orientation === "horizontal";
  const Icon = isHorizontal ? GripVertical : GripHorizontal;

  return (
    <PanelResizeHandle
      aria-label={isHorizontal ? "Redimensionar colunas" : "Redimensionar linhas"}
      className={cn(
        "group relative z-20 flex shrink-0 items-center justify-center bg-background/40 outline-none transition-colors",
        "hover:bg-primary/15 focus-visible:bg-primary/20 data-[separator=active]:bg-primary/20",
        isHorizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-sm border border-border bg-surface-2 text-muted-foreground shadow-sm transition-colors",
          "group-hover:border-primary/60 group-hover:text-primary group-data-[separator=active]:border-primary/70 group-data-[separator=active]:text-primary",
          isHorizontal ? "h-10 w-1.5" : "h-1.5 w-10",
        )}
      >
        <Icon className={cn(isHorizontal ? "h-3 w-3 rotate-90" : "h-3 w-3")} />
      </span>
    </PanelResizeHandle>
  );
}

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
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-1 py-2">
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
    </nav>
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
    <main className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar active={view} onSelect={setView} />

        <PanelGroup
          id="ide-root-layout"
          orientation="horizontal"
          resizeTargetMinimumSize={{ coarse: 28, fine: 10 }}
          className="h-full min-h-0 min-w-0 flex-1"
        >
          {/* Sidebar */}
          <Panel
            id="ide-sidebar"
            defaultSize="18%"
            minSize="220px"
            maxSize="420px"
            className="bg-surface-1"
            style={{ overflow: "hidden" }}
          >
            <div className="flex h-full w-full min-w-0 overflow-hidden">
              <SidebarPanel view={view} />
            </div>
          </Panel>
          <ResizeHandle orientation="horizontal" />

          {/* Editor + bottom terminal */}
          <Panel id="ide-editor-stack" defaultSize="52%" minSize="360px" style={{ overflow: "hidden" }}>
            <PanelGroup
              id="ide-editor-layout"
              orientation="vertical"
              resizeTargetMinimumSize={{ coarse: 28, fine: 10 }}
              className="h-full min-h-0 w-full min-w-0"
            >
              <Panel
                id="ide-editor"
                defaultSize={showTerminal ? "70%" : "100%"}
                minSize="220px"
                style={{ overflow: "hidden" }}
              >
                <div className="h-full w-full min-w-0 overflow-hidden">
                  <EditorArea />
                </div>
              </Panel>
              {showTerminal && (
                <>
                  <ResizeHandle orientation="vertical" />
                  <Panel
                    id="ide-thinking-terminal"
                    defaultSize="30%"
                    minSize="160px"
                    maxSize="55%"
                    className="bg-surface-1"
                    style={{ overflow: "hidden" }}
                  >
                    <div className="h-full w-full min-w-0 overflow-hidden">
                      <ThinkingTerminal />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          <ResizeHandle orientation="horizontal" />

          {/* Chat panel */}
          <Panel
            id="ide-chat"
            defaultSize="30%"
            minSize="340px"
            maxSize="560px"
            className="bg-surface-1"
            style={{ overflow: "hidden" }}
          >
            <div className="flex h-full w-full min-w-0 overflow-hidden">
              <ChatView />
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <StatusBar />
    </main>
  );
}

export function IdeShell() {
  return (
    <WorkspaceProvider>
      <IdeShellInner />
    </WorkspaceProvider>
  );
}
