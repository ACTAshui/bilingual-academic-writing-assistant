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
  return cleanExtractedText(text);
}

const removableBlockEnvironments = [
  "align",
  "alignat",
  "algorithm",
  "algorithmic",
  "array",
  "deluxetable",
  "equation",
  "figure",
  "gather",
  "longtable",
  "lstlisting",
  "multline",
  "subequations",
  "table",
  "tabular",
  "tabularx",
  "threeparttable",
  "tikzpicture",
  "verbatim"
].join("|");

export function cleanTex(text: string): string {
  let body = text.replace(/%.*$/gm, "");
  const documentStart = body.match(/\\begin\{document\}/);

  if (documentStart?.index !== undefined) {
    body = body.slice(documentStart.index + documentStart[0].length);
  }

  body = body
    .replace(/\\end\{document\}[\s\S]*$/g, "")
    .replace(/\\(?:title|author|date)\*?(?:\[[^\]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/^\\(?:documentclass|usepackage)\b.*$/gm, "")
    .replace(/\\maketitle\b/g, "");

  return cleanExtractedText(body);
}

export function cleanExtractedText(text: string): string {
  const body = text
    .replace(/%.*$/gm, "")
    .replace(/\\end\{document\}[\s\S]*$/g, "")
    .replace(/\\(?:title|author|date)\*?(?:\[[^\]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
    .replace(/^\\(?:documentclass|usepackage)\b.*$/gm, "")
    .replace(/\\maketitle\b/g, "")
    .replace(
      new RegExp(
        `\\\\begin\\{(?:${removableBlockEnvironments})\\*?\\}[\\s\\S]*?\\\\end\\{(?:${removableBlockEnvironments})\\*?\\}`,
        "g"
      ),
      ""
    )
    .replace(/\\(?:begin|end)\{abstract\}/g, "\n")
    .replace(/\\(?:begin|end)\{[^}]+\}/g, "\n")
    .replace(
      /\\(section|subsection|subsubsection|paragraph)\*?(?:\[[^\]]*\])?\{([^}]*)\}/g,
      "$2\n"
    )
    .replace(/~?\\(?:cite|parencite|textcite|autocite)\*?(?:\[[^\]]*\]){0,2}\{[^}]*\}/g, "")
    .replace(/\\(?:ref|eqref|label)\*?(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\\[[\s\S]*?\\\]/g, "")
    .replace(/\\\([\s\S]*?\\\)/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[^$\n]*\$/g, "")
    .replace(/\\\\/g, "\n")
    .replace(/\\(textbf|textit|emph|underline|texttt)\{([^}]*)\}/g, "$2")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?/g, "$1")
    .replace(/[{}]/g, "")
    .split(/\r?\n/)
    .filter((line) => !isTexArtifactLine(line))
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return body.trim();
}

function isTexArtifactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return (
    /(?:^|[^\\])&/.test(trimmed) ||
    /(?:^|\s)>?\s*p\s*\(/i.test(trimmed) ||
    /\\(?:toprule|midrule|bottomrule|hline|cline|addlinespace)\b/.test(trimmed) ||
    /^\[\]@?$/.test(trimmed) ||
    /^\[[a-z]\](?:\s+\w+)?$/i.test(trimmed) ||
    /^@+$/.test(trimmed) ||
    /@\s*$/.test(trimmed) ||
    /^(?:term|meaning|meaning in this review|symbol|description|parameter|unit|value)$/i.test(trimmed)
  );
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
          ? cleanExtractedText(extractPdfTextFromBytes(bytes))
          : cleanExtractedText(await parseDocxBytes(bytes));

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
