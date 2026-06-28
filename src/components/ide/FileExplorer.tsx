import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { supportsNativeFs, type FsNode } from "@/lib/workspace/fs-adapter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TreeNodeProps {
  node: FsNode;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const { adapter, openFile, activeTabPath } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FsNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isDir = node.kind === "directory";
  const active = !isDir && activeTabPath === node.path;

  const toggle = useCallback(async () => {
    if (!isDir) {
      void openFile(node.path);
      return;
    }
    const next = !expanded;
    setExpanded(next);
    if (next && children === null && adapter) {
      setLoading(true);
      try {
        const c = await adapter.list(node.path);
        setChildren(c);
      } finally {
        setLoading(false);
      }
    }
  }, [isDir, openFile, node.path, expanded, children, adapter]);

  return (
    <div>
      <button
        onClick={toggle}
        className={cn(
          "flex w-full items-center gap-1 py-0.5 pr-2 text-left text-sm hover:bg-muted/40 transition-colors",
          active && "bg-primary/20 text-foreground",
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        {isDir ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-primary/60" />
          )
        ) : (
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-mono text-xs">{node.name}</span>
      </button>
      {expanded && (
        <div>
          {loading && <div className="py-1 pl-8 text-xs text-muted-foreground">carregando…</div>}
          {children?.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export function FileExplorer() {
  const { adapter, rootName, openNativeFolder, openFromFileList, closeWorkspace } = useWorkspace();
  const [rootNodes, setRootNodes] = useState<FsNode[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!adapter) {
      setRootNodes([]);
      return;
    }
    adapter.list("").then(setRootNodes).catch(() => setRootNodes([]));
  }, [adapter, refreshKey]);

  const handleNative = useCallback(async () => {
    try {
      await openNativeFolder();
    } catch (err) {
      console.error(err);
    }
  }, [openNativeFolder]);

  const handleFallback = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (list && list.length > 0) openFromFileList(list);
    },
    [openFromFileList],
  );

  if (!adapter) {
    return (
      <div className="flex flex-col gap-3 p-4 text-sm">
        <p className="text-muted-foreground">
          Nenhuma pasta aberta. Abra um projeto para começar a editar e conversar com a IA sobre o código.
        </p>
        {supportsNativeFs() ? (
          <Button onClick={handleNative} size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Abrir pasta…
          </Button>
        ) : (
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
            <Upload className="h-4 w-4" />
            Carregar pasta (somente leitura)
            <input
              type="file"
              // @ts-expect-error — atributos não-padrão usados pelos browsers
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFallback}
            />
          </label>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A leitura/escrita real no disco usa a File System Access API (Chrome / Edge). Outros navegadores podem apenas carregar a pasta em memória.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="truncate font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {rootName}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Recarregar"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={closeWorkspace}
            title="Fechar pasta"
          >
            <FolderPlus className="h-3 w-3 rotate-45" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {rootNodes.map((n) => <TreeNode key={n.path} node={n} depth={0} />)}
      </div>
    </div>
  );
}
