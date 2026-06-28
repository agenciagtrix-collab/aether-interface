/**
 * Export e import de projetos como ZIP.
 */
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { CloudFsAdapter } from "./cloud-fs-adapter";

const BUCKET = "projects";

export async function exportProjectAsZip(adapter: CloudFsAdapter, filename: string): Promise<void> {
  const zip = new JSZip();
  for (const path of adapter.allFiles()) {
    try {
      const content = await adapter.readText(path);
      zip.file(path, content);
    } catch {
      // ignora arquivo problemático
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, filename.endsWith(".zip") ? filename : `${filename}.zip`);
}

export async function importZipToProject(
  userId: string,
  projectId: string,
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  let i = 0;
  for (const entry of entries) {
    const content = await entry.async("string");
    const path = entry.name.replace(/^\/+/, "");
    if (!path) continue;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${userId}/${projectId}/${path}`, new Blob([content], { type: "text/plain" }), {
        upsert: true,
        contentType: "text/plain",
      });
    if (error) throw error;
    i++;
    onProgress?.(i, entries.length);
  }
  return i;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
