import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdeShell } from "@/components/ide/IdeShell";
import { PanelProvider } from "@/components/panel/PanelContext";
import { CloudWorkspaceMounter } from "@/components/ide/CloudWorkspaceMounter";
import { Loader2, ArrowLeft } from "lucide-react";

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
      <IdeShell>
        {projectId !== "local" && meta && (
          <CloudWorkspaceMounter userId={meta.userId} projectId={projectId} name={meta.name} />
        )}
        <Link
          to="/"
          className="fixed left-14 top-2 z-50 inline-flex items-center gap-1 rounded-md border border-border bg-surface-1/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur hover:text-foreground"
          title="Voltar para projetos"
        >
          <ArrowLeft className="h-3 w-3" />
          {projectId === "local" ? "Local" : meta?.name ?? "Projeto"}
        </Link>
      </IdeShell>
    </PanelProvider>
  );
}
