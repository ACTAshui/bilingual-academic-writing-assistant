import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  cleanExtractedText,
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

  it("cleans tex-like residue from plain extracted text", () => {
    const cleaned = cleanExtractedText(String.raw`
\RaggedRight Physics-Coupled Machine Learning for Metal Fatigue
[]@
>p(- 2) * 0.3000
[b]
Term
Abstract
`);

    expect(cleaned).toContain(
      "Physics-Coupled Machine Learning for Metal Fatigue"
    );
    expect(cleaned).toContain("Abstract");
    expect(cleaned).not.toContain("\\RaggedRight");
    expect(cleaned).not.toContain(">p");
    expect(cleaned).not.toContain("[b]");
    expect(cleaned).not.toContain("Term");
  });

  it("extracts only readable article text from tex manuscripts", () => {
    const cleaned = cleanTex(String.raw`
\documentclass{article}
\usepackage{amsmath}
\title{Hidden title metadata}
\author{Hidden author}
\begin{document}
\maketitle
\begin{abstract}
This abstract states the main contribution.
\end{abstract}
\section{Introduction}
本文提出一种新的模型，并与 \cite{smith2024} 比较。
\begin{equation}
E = mc^2
\end{equation}
\subsection{Results}
Experimental results demonstrate robust performance.
\end{document}
`);

    expect(cleaned).toContain("This abstract states the main contribution.");
    expect(cleaned).toContain("Introduction");
    expect(cleaned).toContain("本文提出一种新的模型，并与 比较。");
    expect(cleaned).toContain("Results");
    expect(cleaned).toContain(
      "Experimental results demonstrate robust performance."
    );
    expect(cleaned).not.toContain("documentclass");
    expect(cleaned).not.toContain("usepackage");
    expect(cleaned).not.toContain("Hidden title metadata");
    expect(cleaned).not.toContain("maketitle");
    expect(cleaned).not.toContain("begin");
    expect(cleaned).not.toContain("E = mc");
  });

  it("drops latex layout commands, table rows, and column artifacts", () => {
    const cleaned = cleanTex(String.raw`
\begin{document}
\RaggedRight Physics-Coupled Machine Learning for Metal Fatigue: From Data-Driven Predictions to Mechanistic Insights
\begin{tabular}{>{\raggedright}p{0.3000\textwidth} >{\raggedright}p{0.7000\textwidth}}
\(_a\) & alternating stress amplitude \\
\(_m\) & mean stress \\
\end{tabular}
[]@
>p(- 2) * 0.3000
>p(- 2) * 0.7000@
[b]
Term

\section{Introduction}
Modern metal-fatigue datasets combine tabular properties.
\end{document}
`);

    expect(cleaned).toContain(
      "Physics-Coupled Machine Learning for Metal Fatigue"
    );
    expect(cleaned).toContain("Introduction");
    expect(cleaned).toContain(
      "Modern metal-fatigue datasets combine tabular properties."
    );
    expect(cleaned).not.toContain("\\RaggedRight");
    expect(cleaned).not.toContain("alternating stress amplitude");
    expect(cleaned).not.toContain(">p");
    expect(cleaned).not.toContain("[b]");
    expect(cleaned).not.toContain("&");
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
