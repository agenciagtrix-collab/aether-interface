import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdeShell } from "@/components/ide/IdeShell";
import { PanelProvider } from "@/components/panel/PanelContext";
import { CloudWorkspaceMounter } from "@/components/ide/CloudWorkspaceMounter";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ide/$projectId")({
  head: () => ({
    meta: [
      { title: "IDE — Projeto" },
      { name: "description", content: "Edite seu projeto com chat de IA integrado." },
    ],
  }),
  component: IdePage,
});

function IdePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(projectId === "local");
  const [meta, setMeta] = useState<{ name: string; userId: string } | null>(null);

  useEffect(() => {
    if (projectId === "local") return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .single();
      if (error || !data) {
        navigate({ to: "/" });
        return;
      }
      setMeta({ name: data.name, userId: u.user.id });
      setReady(true);
    })();
  }, [projectId, navigate]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PanelProvider>
      <IdeShell topBar={<TopBar projectName={projectId === "local" ? "Pasta local" : meta?.name ?? ""} />}>
        {projectId !== "local" && meta && (
          <CloudWorkspaceMounter userId={meta.userId} projectId={projectId} name={meta.name} />
        )}
      </IdeShell>
    </PanelProvider>
  );
}

function TopBar({ projectName }: { projectName: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-surface-1 px-3 text-xs">
      <Link to="/" className="text-muted-foreground hover:text-foreground">← Projetos</Link>
      <span className="text-muted-foreground">/</span>
      <span className="font-medium">{projectName}</span>
    </div>
  );
}
