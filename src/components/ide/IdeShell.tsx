import { useEffect, useState } from "react";
import {
  Bot,
  Files,
  GripHorizontal,
  GripVertical,
  History,
  MessageSquare,
  Database,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings as SettingsIcon,
} from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { FileExplorer } from "./FileExplorer";
import { EditorArea } from "./EditorArea";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { AuditTemplatesPanel } from "./AuditTemplatesPanel";
import { ChatView } from "@/components/panel/ChatView";
import { ThinkingTerminal } from "@/components/panel/ThinkingTerminal";
import { RealTerminalPanel } from "./RealTerminalPanel";
import { AgentsManager } from "@/components/panel/views/AgentsManager";
import { TaskHistory } from "@/components/panel/views/TaskHistory";
import { MemoryBank } from "@/components/panel/views/MemoryBank";
import { SettingsView } from "@/components/panel/views/Settings";
import { usePanel } from "@/components/panel/PanelContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { loadIdeUiState, saveIdeUiState, resetIdeLayout, type IdeUiState } from "@/lib/workspace/layout-storage";

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
  orientation = "vertical",
}: {
  active: ActivityView;
  onSelect: (v: ActivityView) => void;
  orientation?: "vertical" | "horizontal";
}) {
  const isVertical = orientation === "vertical";
  return (
    <nav
      className={cn(
        "flex shrink-0 items-center gap-1 border-border bg-surface-1",
        isVertical ? "w-12 flex-col border-r py-2" : "h-12 w-full flex-row justify-around border-t px-2",
      )}
    >
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
              <span
                className={cn(
                  "absolute rounded bg-primary",
                  isVertical ? "left-0 top-1/2 h-6 w-0.5 -translate-y-1/2" : "bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2",
                )}
              />
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
  return (
    <div className="p-4 text-xs text-muted-foreground">Use o painel de chat à direita.</div>
  );
}

function StatusBar({
  ui,
  setUi,
  effectiveShowTerminal,
}: {
  ui: IdeUiState;
  setUi: (patch: Partial<IdeUiState>) => void;
  effectiveShowTerminal: boolean;
}) {
  const { rootName, tabs, activeTabPath, supportsWrite } = useWorkspace();
  const active = tabs.find((t) => t.path === activeTabPath);
  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border bg-primary/10 px-3 font-mono text-[10px] text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3 truncate">
        <span className="truncate">{rootName ?? "sem workspace"}</span>
        {active && <span className="hidden sm:inline">{active.language}</span>}
        {active?.dirty && <span className="text-primary">● não salvo</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden md:inline">{supportsWrite ? "FS: leitura/escrita" : "somente leitura"}</span>
        <button
          title="Alternar barra lateral (Ctrl+B)"
          onClick={() => setUi({ showSidebar: !ui.showSidebar })}
          className="rounded p-1 hover:bg-primary/15 hover:text-primary"
        >
          {ui.showSidebar ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </button>
        <button
          title="Alternar terminal (Ctrl+J)"
          onClick={() => setUi({ showTerminal: !effectiveShowTerminal })}
          className="rounded p-1 hover:bg-primary/15 hover:text-primary"
        >
          {effectiveShowTerminal ? <PanelBottomClose className="h-3.5 w-3.5" /> : <PanelBottomOpen className="h-3.5 w-3.5" />}
        </button>
        <button
          title="Alternar chat (Ctrl+Alt+C)"
          onClick={() => setUi({ showChat: !ui.showChat })}
          className="rounded p-1 hover:bg-primary/15 hover:text-primary"
        >
          {ui.showChat ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        </button>
        <button
          title="Resetar layout"
          onClick={() => {
            resetIdeLayout();
            window.location.reload();
          }}
          className="rounded p-1 hover:bg-primary/15 hover:text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MobileShell({
  ui,
  setUi,
  showTerminal,
}: {
  ui: IdeUiState;
  setUi: (patch: Partial<IdeUiState>) => void;
  showTerminal: boolean;
}) {
  const [tab, setTab] = useState<"explorer" | "editor" | "chat">("editor");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex h-full min-h-0 w-full flex-col">
      <TabsList className="m-2 grid w-[calc(100%-1rem)] shrink-0 grid-cols-3">
        <TabsTrigger value="explorer">Arquivos</TabsTrigger>
        <TabsTrigger value="editor">Editor</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
      </TabsList>
      <TabsContent value="explorer" className="min-h-0 flex-1 overflow-hidden bg-surface-1">
        <FileExplorer />
      </TabsContent>
      <TabsContent value="editor" className="min-h-0 flex-1 overflow-hidden">
        <EditorArea />
      </TabsContent>
      <TabsContent value="chat" className="min-h-0 flex-1 overflow-hidden bg-surface-1">
        <ChatView />
      </TabsContent>
      <Sheet open={showTerminal} onOpenChange={(open) => setUi({ showTerminal: open })}>
        <SheetContent side="bottom" className="h-[60vh] p-0">
          <SheetHeader className="border-b border-border p-3">
            <SheetTitle className="text-xs">Pensamento do Agente</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(60vh-3rem)] overflow-hidden">
            <ThinkingTerminal />
          </div>
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}

function IdeShellInner() {
  const { mode } = usePanel();
  const isMobile = useIsMobile();
  const [ui, setUiState] = useState<IdeUiState>(() => loadIdeUiState());

  const setUi = (patch: Partial<IdeUiState>) => {
    setUiState((prev) => {
      const next = { ...prev, ...patch };
      saveIdeUiState(next);
      return next;
    });
  };

  // Override manual; null = segue o modo agente
  const effectiveShowTerminal = ui.showTerminal == null ? mode === "agent" : ui.showTerminal;

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "b" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setUi({ showSidebar: !ui.showSidebar });
      } else if (k === "j" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setUi({ showTerminal: !effectiveShowTerminal });
      } else if (k === "c" && e.altKey) {
        e.preventDefault();
        setUi({ showChat: !ui.showChat });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui.showSidebar, ui.showChat, effectiveShowTerminal]);

  if (isMobile) {
    return (
      <main className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <MobileShell ui={ui} setUi={setUi} showTerminal={effectiveShowTerminal} />
        </div>
        <ActivityBar
          active={ui.activityView as ActivityView}
          onSelect={(v) => setUi({ activityView: v })}
          orientation="horizontal"
        />
        <StatusBar ui={ui} setUi={setUi} effectiveShowTerminal={effectiveShowTerminal} />
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar
          active={ui.activityView as ActivityView}
          onSelect={(v) => setUi({ activityView: v })}
        />

        <PanelGroup
          id="ide-root-layout"
          orientation="horizontal"
          autoSave="ide-root-layout-v1"
          resizeTargetMinimumSize={{ coarse: 28, fine: 10 }}
          className="h-full min-h-0 min-w-0 flex-1"
        >
          {ui.showSidebar && (
            <>
              <Panel
                id="ide-sidebar"
                defaultSize="18%"
                minSize="200px"
                maxSize="420px"
                className="bg-surface-1"
                style={{ overflow: "hidden" }}
              >
                <div className="flex h-full w-full min-w-0 overflow-hidden">
                  <SidebarPanel view={ui.activityView as ActivityView} />
                </div>
              </Panel>
              <ResizeHandle orientation="horizontal" />
            </>
          )}

          <Panel
            id="ide-main"
            defaultSize="52%"
            minSize="320px"
            style={{ overflow: "hidden" }}
          >
            <PanelGroup
              id="ide-editor-layout"
              orientation="vertical"
              autoSave="ide-editor-layout-v1"
              resizeTargetMinimumSize={{ coarse: 28, fine: 10 }}
              className="h-full min-h-0 w-full min-w-0"
            >
              <Panel
                id="ide-editor"
                defaultSize={effectiveShowTerminal ? "70%" : "100%"}
                minSize="200px"
                style={{ overflow: "hidden" }}
              >
                <div className="h-full w-full min-w-0 overflow-hidden">
                  <EditorArea />
                </div>
              </Panel>
              {effectiveShowTerminal && (
                <>
                  <ResizeHandle orientation="vertical" />
                  <Panel
                    id="ide-thinking-terminal"
                    defaultSize="30%"
                    minSize="140px"
                    maxSize="60%"
                    className="bg-surface-1"
                    style={{ overflow: "hidden" }}
                  >
                    <div className="h-full w-full min-w-0 overflow-hidden">
                      <BottomTerminalTabs />
                    </div>

                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {ui.showChat && (
            <>
              <ResizeHandle orientation="horizontal" />
              <Panel
                id="ide-chat"
                defaultSize="30%"
                minSize="300px"
                maxSize="560px"
                className="bg-surface-1"
                style={{ overflow: "hidden" }}
              >
                <div className="flex h-full w-full min-w-0 overflow-hidden">
                  <ChatView />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
      <StatusBar ui={ui} setUi={setUi} effectiveShowTerminal={effectiveShowTerminal} />
    </main>
  );
}

export function IdeShell({ topBar, children }: { topBar?: React.ReactNode; children?: React.ReactNode } = {}) {
  return (
    <WorkspaceProvider>
      {children}
      {topBar}
      <IdeShellInner />
      <AuditTemplatesPanel />
    </WorkspaceProvider>
  );
}
