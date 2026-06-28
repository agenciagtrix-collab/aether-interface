import { useCallback, useEffect, useState } from "react";
import { FileCode, FolderTree, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/ide/WorkspaceContext";
import { cn } from "@/lib/utils";

const MAX_TREE_ENTRIES = 400;
const MAX_TREE_DEPTH = 6;

async function walkTree(
  adapter: NonNullable<ReturnType<typeof useWorkspace>["adapter"]>,
  path = "",
  depth = 0,
  out: string[] = [],
): Promise<string[]> {
  if (out.length >= MAX_TREE_ENTRIES || depth > MAX_TREE_DEPTH) return out;
  const nodes = await adapter.list(path);
  for (const n of nodes) {
    if (out.length >= MAX_TREE_ENTRIES) break;
    out.push(n.path + (n.kind === "directory" ? "/" : ""));
    if (n.kind === "directory") await walkTree(adapter, n.path, depth + 1, out);
  }
  return out;
}


export function CodeContextBar({
  onContextChange,
}: {
  onContextChange: (block: string) => void;
}) {
  const { adapter, tabs, activeTabPath, rootName } = useWorkspace();
  const [includeActive, setIncludeActive] = useState(true);
  const [includeTree, setIncludeTree] = useState(false);
  const [tree, setTree] = useState<string[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  const active = tabs.find((t) => t.path === activeTabPath) ?? null;

  // (re)constrói árvore quando ligado
  useEffect(() => {
    if (!includeTree || !adapter) {
      setTree(null);
      return;
    }
    let cancelled = false;
    setLoadingTree(true);
    walkTree(adapter)
      .then((res) => !cancelled && setTree(res))
      .catch(() => !cancelled && setTree([]))
      .finally(() => !cancelled && setLoadingTree(false));
    return () => {
      cancelled = true;
    };
  }, [includeTree, adapter, rootName]);

  // emite contexto sempre que mudar
  useEffect(() => {
    const parts: string[] = [];
    if (includeActive && active) {
      parts.push(
        `### Arquivo ativo no editor: ${active.path}\n\`\`\`${active.language}\n${active.content}\n\`\`\``,
      );
    }
    if (includeTree && tree) {
      parts.push(`### Estrutura do projeto (${rootName})\n${tree.join("\n")}`);
    }
    onContextChange(parts.length ? `\n\n[Contexto da IDE]\n${parts.join("\n\n")}` : "");
  }, [includeActive, includeTree, active?.path, active?.content, tree, rootName, onContextChange]);

  if (!adapter) return null;

  const chip = (on: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
      on
        ? "border-primary/50 bg-primary/15 text-primary"
        : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background/40 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Contexto:</span>
      <button
        type="button"
        onClick={() => setIncludeActive((v) => !v)}
        disabled={!active}
        className={chip(includeActive && !!active)}
        title={active ? `Incluir ${active.path}` : "Abra um arquivo no editor"}
      >
        <FileCode className="h-3 w-3" />
        Arquivo ativo
        {active && <span className="opacity-60">· {active.name}</span>}
      </button>
      <button
        type="button"
        onClick={() => setIncludeTree((v) => !v)}
        className={chip(includeTree)}
        title="Incluir lista de arquivos do projeto"
      >
        {loadingTree ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderTree className="h-3 w-3" />}
        Estrutura do projeto
        {tree && <span className="opacity-60">· {tree.length}</span>}
      </button>
    </div>
  );
}
