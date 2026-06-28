import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  MemoryFsAdapter,
  NativeFsAdapter,
  supportsNativeFs,
  type FsAdapter,
} from "@/lib/workspace/fs-adapter";

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  language: string;
  dirty: boolean;
}

export interface FileEdit {
  id: string;
  path: string;
  previousContent: string | null; // null = arquivo novo
  newContent: string;
  timestamp: number;
  reverted?: boolean;
}

interface WorkspaceState {
  adapter: FsAdapter | null;
  rootName: string | null;
  tabs: OpenTab[];
  activeTabPath: string | null;
  edits: FileEdit[];
  /** Abre o picker nativo (Chromium) — throws se não suportado. */
  openNativeFolder: () => Promise<void>;
  /** Adapter a partir de upload de pasta (fallback). */
  openFromFileList: (list: FileList) => void;
  closeWorkspace: () => void;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveTab: (path: string) => Promise<void>;
  saveAll: () => Promise<void>;
  /** Escreve/cria arquivo no disco, registra snapshot p/ undo e abre a aba. */
  applyEdit: (path: string, content: string) => Promise<FileEdit | null>;
  /** Desfaz uma edição registrada (restaura conteúdo anterior). */
  revertEdit: (id: string) => Promise<void>;
  supportsWrite: boolean;
}

const Ctx = createContext<WorkspaceState | null>(null);

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  json: "json", md: "markdown", mdx: "markdown", css: "css", scss: "scss",
  html: "html", xml: "xml", yml: "yaml", yaml: "yaml", toml: "ini",
  py: "python", go: "go", rs: "rust", java: "java", c: "c", cpp: "cpp",
  h: "cpp", hpp: "cpp", sql: "sql", sh: "shell", bash: "shell",
  env: "shell", gitignore: "ignore",
};

function detectLanguage(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return LANG_BY_EXT[ext] ?? "plaintext";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<FsAdapter | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActivePath] = useState<string | null>(null);

  const openNativeFolder = useCallback(async () => {
    if (!supportsNativeFs()) {
      throw new Error("Seu navegador não suporta abrir pastas com leitura/escrita. Use Chrome/Edge.");
    }
    try {
      const a = await NativeFsAdapter.open();
      setAdapter(a);
      setTabs([]);
      setActivePath(null);
      toast.success(`Pasta aberta: ${a.rootName}`);
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      throw err;
    }
  }, []);

  const openFromFileList = useCallback((list: FileList) => {
    const a = MemoryFsAdapter.fromFileList(list);
    setAdapter(a);
    setTabs([]);
    setActivePath(null);
    toast.info(`Pasta carregada (somente leitura): ${a.rootName}`);
  }, []);

  const closeWorkspace = useCallback(() => {
    setAdapter(null);
    setTabs([]);
    setActivePath(null);
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      if (!adapter) return;
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActivePath(path);
        return;
      }
      try {
        const content = await adapter.readText(path);
        const name = path.split("/").pop() ?? path;
        setTabs((t) => [
          ...t,
          { path, name, content, originalContent: content, language: detectLanguage(name), dirty: false },
        ]);
        setActivePath(path);
      } catch (err) {
        toast.error(`Erro ao abrir ${path}: ${(err as Error).message}`);
      }
    },
    [adapter, tabs],
  );

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activeTabPath === path) {
          setActivePath(next.length ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activeTabPath],
  );

  const updateTabContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content, dirty: content !== t.originalContent } : t)),
    );
  }, []);

  const saveTab = useCallback(
    async (path: string) => {
      if (!adapter) return;
      const tab = tabs.find((t) => t.path === path);
      if (!tab) return;
      if (!adapter.canWrite()) {
        toast.error("Escrita não suportada — use Chrome/Edge para salvar.");
        return;
      }
      try {
        await adapter.writeText(path, tab.content);
        setTabs((prev) =>
          prev.map((t) => (t.path === path ? { ...t, originalContent: t.content, dirty: false } : t)),
        );
        toast.success(`Salvo: ${tab.name}`);
      } catch (err) {
        toast.error(`Falha ao salvar: ${(err as Error).message}`);
      }
    },
    [adapter, tabs],
  );

  const saveAll = useCallback(async () => {
    for (const t of tabs) if (t.dirty) await saveTab(t.path);
  }, [tabs, saveTab]);

  const value = useMemo<WorkspaceState>(
    () => ({
      adapter,
      rootName: adapter?.rootName ?? null,
      tabs,
      activeTabPath,
      openNativeFolder,
      openFromFileList,
      closeWorkspace,
      openFile,
      closeTab,
      setActiveTab: setActivePath,
      updateTabContent,
      saveTab,
      saveAll,
      supportsWrite: adapter?.canWrite() ?? false,
    }),
    [adapter, tabs, activeTabPath, openNativeFolder, openFromFileList, closeWorkspace, openFile, closeTab, updateTabContent, saveTab, saveAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace precisa de <WorkspaceProvider>");
  return v;
}
