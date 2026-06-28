/**
 * File System abstraction.
 *
 * NativeFsAdapter usa a File System Access API (Chromium/Edge): leitura E escrita reais no disco.
 * MemoryFsAdapter usa <input webkitdirectory> ou drag-and-drop: read-only (fallback).
 */

export interface FsNode {
  /** Path POSIX relativo à raiz, sem barra inicial. "" = raiz. */
  path: string;
  name: string;
  kind: "file" | "directory";
}

export interface FsAdapter {
  readonly kind: "native" | "memory";
  readonly rootName: string;
  /** Lista filhos diretos do diretório `path` (vazio = raiz). */
  list(path: string): Promise<FsNode[]>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  canWrite(): boolean;
}

export const EXCLUDED_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".cache",
  ".DS_Store",
  ".vercel",
  ".output",
]);

/* ------------------------------------------------------------------ */
/* Capabilities                                                       */
/* ------------------------------------------------------------------ */

export function supportsNativeFs(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/* ------------------------------------------------------------------ */
/* Native (Chromium/Edge)                                             */
/* ------------------------------------------------------------------ */

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

export class NativeFsAdapter implements FsAdapter {
  readonly kind = "native" as const;
  readonly rootName: string;
  private root: DirHandle;

  constructor(root: DirHandle) {
    this.root = root;
    this.rootName = root.name;
  }

  static async open(): Promise<NativeFsAdapter> {
    const handle = await (window as unknown as {
      showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<DirHandle>;
    }).showDirectoryPicker({ mode: "readwrite" });
    return new NativeFsAdapter(handle);
  }

  canWrite() {
    return true;
  }

  private async resolveDir(path: string): Promise<DirHandle> {
    if (!path) return this.root;
    let cur: DirHandle = this.root;
    for (const seg of path.split("/").filter(Boolean)) {
      cur = await cur.getDirectoryHandle(seg);
    }
    return cur;
  }

  private async resolveFile(path: string): Promise<FileHandle> {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error("Caminho inválido");
    const dir = await this.resolveDir(parts.join("/"));
    return dir.getFileHandle(name);
  }

  async list(path: string): Promise<FsNode[]> {
    const dir = await this.resolveDir(path);
    const out: FsNode[] = [];
    // entries() existe em runtime
    for await (const [name, entry] of dir.entries()) {
      if (EXCLUDED_NAMES.has(name)) continue;
      out.push({
        name,
        path: path ? `${path}/${name}` : name,
        kind: entry.kind === "directory" ? "directory" : "file",
      });
    }
    return out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readText(path: string): Promise<string> {
    const fh = await this.resolveFile(path);
    const file = await fh.getFile();
    return file.text();
  }

  async writeText(path: string, content: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error("Caminho inválido");
    let dir: DirHandle = this.root;
    for (const seg of parts) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }
    const fh = await dir.getFileHandle(name, { create: true });
    // createWritable existe em runtime
    const writable = await fh.createWritable();
    await writable.write(content);
    await writable.close();
  }
}

/* ------------------------------------------------------------------ */
/* Memory (fallback: upload de pasta, sem escrita)                    */
/* ------------------------------------------------------------------ */

export class MemoryFsAdapter implements FsAdapter {
  readonly kind = "memory" as const;
  readonly rootName: string;
  /** Map<path, File> */
  private files = new Map<string, File>();

  constructor(rootName: string, files: Array<{ path: string; file: File }>) {
    this.rootName = rootName;
    for (const { path, file } of files) this.files.set(path, file);
  }

  static fromFileList(list: FileList): MemoryFsAdapter {
    const arr: Array<{ path: string; file: File }> = [];
    let rootName = "workspace";
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
      const segs = rel.split("/");
      if (i === 0 && segs.length > 1) rootName = segs[0];
      const path = segs.slice(1).join("/") || file.name;
      if (segs.some((s) => EXCLUDED_NAMES.has(s))) continue;
      arr.push({ path, file });
    }
    return new MemoryFsAdapter(rootName, arr);
  }

  canWrite() {
    return false;
  }

  async list(path: string): Promise<FsNode[]> {
    const prefix = path ? `${path}/` : "";
    const seen = new Map<string, FsNode>();
    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      if (!rest) continue;
      const [head, ...tail] = rest.split("/");
      if (seen.has(head)) continue;
      seen.set(head, {
        name: head,
        path: prefix + head,
        kind: tail.length > 0 ? "directory" : "file",
      });
    }
    return [...seen.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readText(path: string): Promise<string> {
    const f = this.files.get(path);
    if (!f) throw new Error(`Arquivo não encontrado: ${path}`);
    return f.text();
  }

  async writeText(): Promise<void> {
    throw new Error(
      "Escrita não suportada neste navegador. Use Chrome/Edge para salvar arquivos no disco.",
    );
  }
}
