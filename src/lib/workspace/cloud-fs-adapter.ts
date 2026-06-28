/**
 * Adapter de filesystem usando Lovable Cloud Storage (bucket "projects").
 * Caminho no storage: {userId}/{projectId}/{relativePath}
 * Lista todos os arquivos do projeto uma vez e mantém em memória; cada write sobe pro storage.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FsAdapter, FsNode } from "./fs-adapter";
import { EXCLUDED_NAMES } from "./fs-adapter";

const BUCKET = "projects";

export class CloudFsAdapter implements FsAdapter {
  readonly kind = "native" as const; // tratado como editável
  readonly rootName: string;
  private files = new Set<string>(); // paths relativos ao projeto
  private cache = new Map<string, string>(); // path -> conteúdo
  private prefix: string;

  constructor(public userId: string, public projectId: string, name: string) {
    this.rootName = name;
    this.prefix = `${userId}/${projectId}`;
  }

  canWrite() {
    return true;
  }

  async hydrate(): Promise<void> {
    this.files.clear();
    await this.walk("");
  }

  private async walk(rel: string): Promise<void> {
    const path = rel ? `${this.prefix}/${rel}` : this.prefix;
    const { data, error } = await supabase.storage.from(BUCKET).list(path, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.name === ".emptyFolderPlaceholder") continue;
      if (EXCLUDED_NAMES.has(item.name)) continue;
      const childRel = rel ? `${rel}/${item.name}` : item.name;
      // Supabase marca diretórios com id null
      if (item.id === null) {
        await this.walk(childRel);
      } else {
        this.files.add(childRel);
      }
    }
  }

  async list(path: string): Promise<FsNode[]> {
    const prefix = path ? `${path}/` : "";
    const seen = new Map<string, FsNode>();
    for (const fp of this.files) {
      if (!fp.startsWith(prefix)) continue;
      const rest = fp.slice(prefix.length);
      if (!rest) continue;
      const [head, ...tail] = rest.split("/");
      if (seen.has(head)) continue;
      seen.set(head, {
        name: head,
        path: prefix + head,
        kind: tail.length ? "directory" : "file",
      });
    }
    return [...seen.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readText(path: string): Promise<string> {
    if (this.cache.has(path)) return this.cache.get(path)!;
    const { data, error } = await supabase.storage.from(BUCKET).download(`${this.prefix}/${path}`);
    if (error) throw error;
    const text = await data.text();
    this.cache.set(path, text);
    return text;
  }

  async writeText(path: string, content: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${this.prefix}/${path}`, new Blob([content], { type: "text/plain" }), {
        upsert: true,
        contentType: "text/plain",
      });
    if (error) throw error;
    this.files.add(path);
    this.cache.set(path, content);
  }

  async deletePath(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([`${this.prefix}/${path}`]);
    this.files.delete(path);
    this.cache.delete(path);
  }

  /** Lista todos os arquivos (para ZIP export). */
  allFiles(): string[] {
    return [...this.files];
  }
}
