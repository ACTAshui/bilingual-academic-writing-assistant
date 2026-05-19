import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { Paragraph } from "../types";
import {
  createDownload,
  exportBilingualText,
  exportDocxBlob,
  exportEnglishText
} from "./exporters";

describe("exporters", () => {
  const paragraphs: Paragraph[] = [
    {
      id: "p-1",
      sourceZh: "第一段。",
      draftEn: "First paragraph.",
      status: "accepted",
      notes: [],
      history: ["First paragraph."]
    },
    {
      id: "p-2",
      sourceZh: "第二段。",
      draftEn: "Second paragraph.",
      status: "edited",
      notes: [],
      history: ["Second paragraph."]
    }
  ];

  it("exports English-only text from current draft state", () => {
    expect(exportEnglishText(paragraphs)).toBe(
      "First paragraph.\n\nSecond paragraph."
    );
  });

  it("exports aligned bilingual text from current editor state", () => {
    expect(exportBilingualText(paragraphs)).toContain("ZH: 第一段。");
    expect(exportBilingualText(paragraphs)).toContain("EN: First paragraph.");
  });

  it("creates named download blobs", () => {
    const download = createDownload("paper.txt", "text/plain", "content");

    expect(download.fileName).toBe("paper.txt");
    expect(download.blob.type).toBe("text/plain");
  });

  it("generates a minimal docx blob containing document xml", async () => {
    const blob = await exportDocxBlob(paragraphs, "english");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    await expect(zip.file("word/document.xml")?.async("string")).resolves.toContain(
      "First paragraph."
    );
  });
});
