import JSZip from "jszip";
import type { AttachedFile } from "@/components/panel/PanelContext";

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "mdx", "json", "csv", "ts", "tsx", "js", "jsx", "css", "scss", "html", "xml",
  "yaml", "yml", "toml", "py", "go", "rs", "java", "c", "cpp", "h", "hpp", "sql", "env", "gitignore",
]);

const CODE_PRIORITY = [
  "package.json", "readme", "src/", "app/", "components/", "lib/", "hooks/", "routes/", "pages/",
  "index.", "main.", "vite.config", "tsconfig", "tailwind", "styles", "schema", "migration",
];

const EXCLUDED_PATH_PARTS = ["node_modules/", ".git/", "dist/", "build/", ".next/", ".turbo/", "coverage/"];
const MAX_TEXT_CHARS = 30_000;
const MAX_ARCHIVE_CHARS = 80_000;
const MAX_ARCHIVE_FILES = 35;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileExtension(name: string): string {
  const clean = name.toLowerCase().split(/[?#]/)[0] ?? name.toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop() ?? "" : clean.replace(/^\./, "");
}

function isReadableTextFile(name: string, type: string): boolean {
  return type.startsWith("text/") || TEXT_EXTENSIONS.has(fileExtension(name));
}

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip") || file.type.includes("zip");
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n\n[conteúdo truncado: ${text.length - max} caracteres omitidos]` : text;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function archiveScore(path: string): number {
  const lower = path.toLowerCase();
  if (EXCLUDED_PATH_PARTS.some((part) => lower.includes(part))) return -1;
  let score = isReadableTextFile(path, "") ? 10 : 0;
  CODE_PRIORITY.forEach((term, index) => {
    if (lower.includes(term)) score += 100 - index * 4;
  });
  if (lower.includes("lock")) score -= 30;
  return score;
}

async function readZip(file: File): Promise<AttachedFile> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ entry, score: archiveScore(entry.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ARCHIVE_FILES);

  const sections: string[] = [];
  let usedChars = 0;

  for (const { entry } of entries) {
    if (usedChars >= MAX_ARCHIVE_CHARS) break;
    const raw = await entry.async("string");
    const remaining = Math.max(0, MAX_ARCHIVE_CHARS - usedChars);
    const content = truncate(raw, Math.min(MAX_TEXT_CHARS, remaining));
    sections.push(`--- ${entry.name} ---\n${content}`);
    usedChars += content.length;
  }

  const totalFiles = Object.values(zip.files).filter((entry) => !entry.dir).length;
  const summary = `ZIP lido: ${entries.length}/${totalFiles} arquivos textuais relevantes incluídos (${formatBytes(file.size)}).`;

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/zip",
    size: file.size,
    kind: "archive",
    summary,
    content: sections.length ? sections.join("\n\n") : "Nenhum arquivo textual legível encontrado no ZIP.",
  };
}

export async function readAttachment(file: File): Promise<AttachedFile> {
  try {
    if (isZipFile(file)) return readZip(file);

    if (isReadableTextFile(file.name, file.type)) {
      const text = await file.text();
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        kind: "text",
        summary: `Arquivo textual lido (${formatBytes(file.size)}).`,
        content: truncate(text, MAX_TEXT_CHARS),
      };
    }

    if (file.type.startsWith("image/")) {
      const canInline = file.size <= MAX_IMAGE_BYTES;
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        kind: "image",
        summary: canInline
          ? `Imagem lida (${formatBytes(file.size)}). Será enviada para modelos compatíveis com visão.`
          : `Imagem anexada (${formatBytes(file.size)}), mas excede ${formatBytes(MAX_IMAGE_BYTES)} e será enviada apenas como metadados.`,
        dataUrl: canInline ? await readAsDataUrl(file) : undefined,
      };
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      kind: "binary",
      summary: `Arquivo binário anexado (${formatBytes(file.size)}). Conteúdo não textual não pôde ser extraído no navegador.`,
    };
  } catch (error) {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      kind: "error",
      summary: "Falha ao ler o arquivo.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildAttachmentContext(files: AttachedFile[]): string {
  if (files.length === 0) return "";
  return files
    .map((file, index) => {
      const body = file.content ? `\nConteúdo extraído:\n${file.content}` : "";
      const error = file.error ? `\nErro de leitura: ${file.error}` : "";
      return `[Arquivo ${index + 1}] ${file.name}\nTipo: ${file.type || file.kind}\nResumo: ${file.summary}${error}${body}`;
    })
    .join("\n\n");
}