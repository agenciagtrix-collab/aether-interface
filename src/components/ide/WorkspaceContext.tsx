import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";

const EDITS_STORAGE_KEY = "jarvis_agent_edits_v1";
const EDITS_MAX = 200;
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
  /** Injeta adapter externo (ex.: nuvem). */
  setExternalAdapter: (adapter: FsAdapter) => void;
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
  const [edits, setEdits] = useState<FileEdit[]>([]);
  const editsHydrated = useRef(false);

  // Hidrata do IndexedDB no mount
  useEffect(() => {
    let cancelled = false;
    idbGet<FileEdit[]>(EDITS_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && Array.isArray(stored) && stored.length) {
          setEdits(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        editsHydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persiste mudanças (após hidratação) — cap em EDITS_MAX mais recentes
  useEffect(() => {
    if (!editsHydrated.current) return;
    const trimmed = edits.length > EDITS_MAX ? edits.slice(-EDITS_MAX) : edits;
    idbSet(EDITS_STORAGE_KEY, trimmed).catch(() => {});
  }, [edits]);


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

  const applyEdit = useCallback(
    async (path: string, content: string): Promise<FileEdit | null> => {
      if (!adapter) {
        toast.error("Abra uma pasta de trabalho primeiro.");
        return null;
      }
      if (!adapter.canWrite()) {
        toast.error("Escrita não suportada — use Chrome/Edge com pasta aberta nativamente.");
        return null;
      }
      let previousContent: string | null = null;
      try {
        previousContent = await adapter.readText(path);
      } catch {
        previousContent = null; // arquivo novo
      }
      try {
        await adapter.writeText(path, content);
      } catch (err) {
        toast.error(`Falha ao escrever ${path}: ${(err as Error).message}`);
        return null;
      }
      const edit: FileEdit = {
        id: crypto.randomUUID(),
        path,
        previousContent,
        newContent: content,
        timestamp: Date.now(),
      };
      setEdits((prev) => [...prev, edit]);
      // sincroniza tab aberta (se houver) e abre se não
      setTabs((prev) => {
        const existing = prev.find((t) => t.path === path);
        if (existing) {
          return prev.map((t) =>
            t.path === path ? { ...t, content, originalContent: content, dirty: false } : t,
          );
        }
        const name = path.split("/").pop() ?? path;
        return [
          ...prev,
          { path, name, content, originalContent: content, language: detectLanguage(name), dirty: false },
        ];
      });
      setActivePath(path);
      toast.success(previousContent === null ? `Criado: ${path}` : `Atualizado: ${path}`);
      return edit;
    },
    [adapter],
  );

  const revertEdit = useCallback(
    async (id: string) => {
      const edit = edits.find((e) => e.id === id);
      if (!edit || edit.reverted || !adapter) return;
      try {
        if (edit.previousContent === null) {
          toast.warning(`Arquivo novo ${edit.path} — exclua manualmente via Explorer.`);
        } else {
          await adapter.writeText(edit.path, edit.previousContent);
          setTabs((prev) =>
            prev.map((t) =>
              t.path === edit.path
                ? { ...t, content: edit.previousContent!, originalContent: edit.previousContent!, dirty: false }
                : t,
            ),
          );
          toast.success(`Revertido: ${edit.path}`);
        }
        setEdits((prev) => prev.map((e) => (e.id === id ? { ...e, reverted: true } : e)));
      } catch (err) {
        toast.error(`Falha ao reverter: ${(err as Error).message}`);
      }
    },
    [adapter, edits],
  );

  const value = useMemo<WorkspaceState>(
    () => ({
      adapter,
      rootName: adapter?.rootName ?? null,
      tabs,
      activeTabPath,
      edits,
      openNativeFolder,
      openFromFileList,
      closeWorkspace,
      openFile,
      closeTab,
      setActiveTab: setActivePath,
      updateTabContent,
      saveTab,
      saveAll,
      applyEdit,
      revertEdit,
      supportsWrite: adapter?.canWrite() ?? false,
    }),
    [adapter, tabs, activeTabPath, edits, openNativeFolder, openFromFileList, closeWorkspace, openFile, closeTab, updateTabContent, saveTab, saveAll, applyEdit, revertEdit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace precisa de <WorkspaceProvider>");
  return v;
}
