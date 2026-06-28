import { useEffect, useState } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { CloudFsAdapter } from "@/lib/workspace/cloud-fs-adapter";
import { toast } from "sonner";

/**
 * Monta o adapter de nuvem no WorkspaceContext quando o componente entra em cena.
 * Renderiza nada — efeito puro.
 */
export function CloudWorkspaceMounter({
  userId,
  projectId,
  name,
}: {
  userId: string;
  projectId: string;
  name: string;
}) {
  const { setExternalAdapter } = useWorkspace();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = new CloudFsAdapter(userId, projectId, name);
        await adapter.hydrate();
        if (cancelled) return;
        setExternalAdapter(adapter);
        setMounted(true);
        toast.success(`Projeto na nuvem: ${name}`);
      } catch (err) {
        toast.error(`Erro abrindo projeto: ${(err as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId]);

  return mounted ? null : (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-md border border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
      ☁ Carregando projeto…
    </div>
  );
}
