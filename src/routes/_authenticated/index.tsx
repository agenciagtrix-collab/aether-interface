import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Cloud, FolderOpen, Plus, Trash2, Download, Upload, LogOut, Loader2, Pencil, MonitorSmartphone } from "lucide-react";
import { CloudFsAdapter } from "@/lib/workspace/cloud-fs-adapter";
import { exportProjectAsZip, importZipToProject } from "@/lib/workspace/zip-io";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Meus Projetos — IDE de IA" },
      { name: "description", content: "Seus projetos salvos na nuvem." },
    ],
  }),
  component: ProjectsPage,
});

interface Project {
  id: string;
  name: string;
  updated_at: string;
}

function ProjectsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email ?? "");
      }
    });
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setProjects(data ?? []);
    setLoading(false);
  }

  async function createProject() {
    const name = newName.trim() || `Projeto ${new Date().toLocaleDateString("pt-BR")}`;
    if (!userId) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, user_id: userId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setNewName("");
    toast.success("Projeto criado");
    navigate({ to: "/ide/$projectId", params: { projectId: data.id } });
  }

  async function deleteProject(p: Project) {
    if (!confirm(`Apagar "${p.name}" e todos os arquivos? Não tem volta.`)) return;
    setBusyId(p.id);
    try {
      // Apaga arquivos do storage
      if (userId) {
        const folder = `${userId}/${p.id}`;
        const { data: files } = await supabase.storage.from("projects").list(folder, { limit: 1000 });
        if (files?.length) {
          await supabase.storage.from("projects").remove(files.map((f) => `${folder}/${f.name}`));
        }
      }
      await supabase.from("projects").delete().eq("id", p.id);
      toast.success("Apagado");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function renameProject(p: Project) {
    const name = prompt("Novo nome:", p.name);
    if (!name || name === p.name) return;
    const { error } = await supabase.from("projects").update({ name }).eq("id", p.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function exportProject(p: Project) {
    if (!userId) return;
    setBusyId(p.id);
    try {
      const adapter = new CloudFsAdapter(userId, p.id, p.name);
      await adapter.hydrate();
      await exportProjectAsZip(adapter, p.name);
      toast.success("ZIP baixado");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function importZip(file: File) {
    if (!userId) return;
    const name = file.name.replace(/\.zip$/i, "") || "Importado";
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, user_id: userId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setBusyId(data.id);
    try {
      const count = await importZipToProject(userId, data.id, file, (c, t) => {
        if (c % 5 === 0 || c === t) toast.info(`${c}/${t} arquivos...`, { id: "import" });
      });
      toast.success(`Importados ${count} arquivos`, { id: "import" });
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
      await supabase.from("projects").delete().eq("id", data.id);
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface-1 px-6 py-4">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">Meus Projetos</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Card className="mb-6 border-border bg-surface-1">
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Input
              placeholder="Nome do novo projeto"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              className="max-w-xs"
            />
            <Button onClick={createProject}>
              <Plus className="mr-2 h-4 w-4" /> Novo projeto
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Importar .zip
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importZip(f);
                e.target.value = "";
              }}
            />
            <Link to="/ide/$projectId" params={{ projectId: "local" }}>
              <Button variant="ghost">
                <MonitorSmartphone className="mr-2 h-4 w-4" /> Modo local (pasta do PC)
              </Button>
            </Link>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            Nenhum projeto ainda. Crie um novo ou importe um .zip.
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <Card key={p.id} className="border-border bg-surface-1">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <Link
                    to="/ide/$projectId"
                    params={{ projectId: p.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Atualizado {new Date(p.updated_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    {busyId === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Button variant="ghost" size="icon" title="Renomear" onClick={() => renameProject(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Baixar .zip" onClick={() => exportProject(p)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Apagar" onClick={() => deleteProject(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
