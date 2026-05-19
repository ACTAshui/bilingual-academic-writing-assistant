import JSZip from "jszip";
import type { Paragraph } from "../types";

export type DownloadArtifact = {
  fileName: string;
  blob: Blob;
};

export function exportEnglishText(paragraphs: Paragraph[]): string {
  return paragraphs
    .map((paragraph) => paragraph.draftEn.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function exportBilingualText(paragraphs: Paragraph[]): string {
  return paragraphs
    .map(
      (paragraph, index) =>
        `# Paragraph ${index + 1}\nZH: ${paragraph.sourceZh.trim()}\nEN: ${paragraph.draftEn.trim()}`
    )
    .join("\n\n");
}

export function createDownload(
  fileName: string,
  mimeType: string,
  content: string | Uint8Array | Blob
): DownloadArtifact {
  return {
    fileName,
    blob:
      content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType })
  };
}

export async function exportDocxBlob(
  paragraphs: Paragraph[],
  mode: "english" | "bilingual"
): Promise<Blob> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")?.file(".rels", rootRelsXml());
  zip.folder("word")?.file("document.xml", documentXml(paragraphs, mode));

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }) as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };

  if (typeof blob.arrayBuffer !== "function") {
    blob.arrayBuffer = async () =>
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
  }

  return blob;
}

function documentXml(paragraphs: Paragraph[], mode: "english" | "bilingual") {
  const body = paragraphs
    .flatMap((paragraph) =>
      mode === "english"
        ? [paragraph.draftEn]
        : [`ZH: ${paragraph.sourceZh}`, `EN: ${paragraph.draftEn}`]
    )
    .filter((line) => line.trim())
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr /></w:body>
</w:document>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
