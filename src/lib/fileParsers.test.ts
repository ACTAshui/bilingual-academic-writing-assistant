import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  cleanTex,
  detectFileType,
  extractPdfTextFromBytes,
  parseDocxBytes,
  parsePlainText,
  parseUploadedFile
} from "./fileParsers";

describe("fileParsers", () => {
  it("detects supported file types from names", () => {
    expect(detectFileType("paper.docx")).toBe("docx");
    expect(detectFileType("paper.txt")).toBe("txt");
    expect(detectFileType("paper.tex")).toBe("tex");
    expect(detectFileType("paper.pdf")).toBe("pdf");
    expect(() => detectFileType("paper.md")).toThrow("Unsupported file type");
  });

  it("keeps txt content and cleans common tex commands", () => {
    expect(parsePlainText("A\n\nB")).toBe("A\n\nB");

    const cleaned = cleanTex("\\section{Methods}\nThis is \\textbf{important}.");

    expect(cleaned).toContain("Methods");
    expect(cleaned).toContain("This is important.");
    expect(cleaned).not.toContain("\\textbf");
  });

  it("extracts simple literal strings from pdf bytes", () => {
    const bytes = new TextEncoder().encode(
      "%PDF-1.4\n(Introduction) Tj\n(Methods) Tj"
    );

    expect(extractPdfTextFromBytes(bytes)).toContain("Introduction");
    expect(extractPdfTextFromBytes(bytes)).toContain("Methods");
  });

  it("extracts paragraph text from docx bytes", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p>
          <w:p><w:r><w:t>Second</w:t></w:r><w:r><w:t> paragraph.</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });

    expect(await parseDocxBytes(bytes)).toBe(
      "First paragraph.\n\nSecond paragraph."
    );
  });

  it("parses browser File objects by extension", async () => {
    const file = new File(["\\section{Results}\n我们提出一种方法。"], "paper.tex", {
      type: "application/x-tex"
    });

    await expect(parseUploadedFile(file)).resolves.toMatchObject({
      name: "paper.tex",
      type: "tex",
      text: expect.stringContaining("Results")
    });
  });
});
