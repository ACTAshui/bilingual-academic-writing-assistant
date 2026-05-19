import JSZip from "jszip";
import type { ParsedFile, SupportedFileType } from "../types";

const supportedExtensions: Record<string, SupportedFileType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".tex": "tex"
};

export function detectFileType(fileName: string): SupportedFileType {
  const normalized = fileName.toLowerCase();
  const extension = Object.keys(supportedExtensions).find((candidate) =>
    normalized.endsWith(candidate)
  );

  if (!extension) {
    throw new Error("Unsupported file type");
  }

  return supportedExtensions[extension];
}

export function parsePlainText(text: string): string {
  return text;
}

export function cleanTex(text: string): string {
  return text
    .replace(/%.*$/gm, "")
    .replace(/\\(section|subsection|subsubsection|paragraph)\*?\{([^}]*)\}/g, "$2\n")
    .replace(/\\(textbf|textit|emph|cite|ref|label)\{([^}]*)\}/g, "$2")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractPdfTextFromBytes(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const matches = [...raw.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)];
  const lines = matches.map((match) =>
    match[0]
      .replace(/\)\s*Tj$/, "")
      .slice(1)
      .replace(/\\([()\\])/g, "$1")
      .trim()
  );

  return lines.filter(Boolean).join("\n\n");
}

export async function parseDocxBytes(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("DOCX document body not found");
  }

  const paragraphs = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(
    ([paragraphXml]) => {
      const textRuns = [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)];
      return textRuns.map((run) => decodeXml(run[1])).join("");
    }
  );

  return paragraphs.filter((paragraph) => paragraph.trim()).join("\n\n");
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const type = detectFileType(file.name);
  const bytes = new Uint8Array(await readFileBytes(file));
  const text =
    type === "txt"
      ? parsePlainText(new TextDecoder().decode(bytes))
      : type === "tex"
        ? cleanTex(new TextDecoder().decode(bytes))
        : type === "pdf"
          ? extractPdfTextFromBytes(bytes)
          : await parseDocxBytes(bytes);

  if (!text.trim()) {
    throw new Error("Imported file did not contain readable text");
  }

  return {
    name: file.name,
    type,
    text
  };
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
