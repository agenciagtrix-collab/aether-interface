import { lazy, Suspense, useEffect } from "react";
import { X, Save, FileCode } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

export function EditorArea() {
  const { tabs, activeTabPath, setActiveTab, closeTab, updateTabContent, saveTab, saveAll, supportsWrite } =
    useWorkspace();
  const active = tabs.find((t) => t.path === activeTabPath) ?? null;

  // Ctrl/Cmd+S => salvar arquivo ativo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) void saveAll();
        else if (active) void saveTab(active.path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, saveTab, saveAll]);

  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <FileCode className="h-10 w-10 opacity-40" />
        <div>
          <p className="text-sm">Nenhum arquivo aberto</p>
          <p className="mt-1 text-xs">Escolha um arquivo na árvore à esquerda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex h-9 shrink-0 items-center overflow-x-auto border-b border-border bg-surface-1">
        {tabs.map((t) => {
          const isActive = t.path === activeTabPath;
          return (
            <div
              key={t.path}
              className={cn(
                "group flex h-full shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 text-xs",
                isActive ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted/30",
              )}
              onClick={() => setActiveTab(t.path)}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span className="font-mono">{t.name}</span>
              {t.dirty && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Modificado" />}
              <button
                className="ml-1 rounded p-0.5 opacity-60 hover:bg-muted hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.path);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1 pr-2">
          {active?.dirty && supportsWrite && (
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => saveTab(active.path)}>
              <Save className="h-3.5 w-3.5" />
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Path / breadcrumb */}
      {active && (
        <div className="shrink-0 border-b border-border bg-background/50 px-3 py-1 font-mono text-[11px] text-muted-foreground">
          {active.path}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {active && (
          <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Carregando editor…</div>}>
            <MonacoEditor
              key={active.path}
              height="100%"
              theme="vs-dark"
              language={active.language}
              value={active.content}
              onChange={(v) => updateTabContent(active.path, v ?? "")}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                readOnly: !supportsWrite,
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
