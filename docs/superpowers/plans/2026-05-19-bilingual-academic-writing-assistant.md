# Bilingual Academic Writing Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that imports `docx`, `txt`, and `tex` manuscripts, provides synchronized Chinese-English editing, supports academic AI actions through selectable providers, learns style cues from up to 10 reference papers, and exports edited results.

**Architecture:** Use a Vite + React + TypeScript single-page app. Keep core behavior in testable pure modules (`fileParsers`, `documentModel`, `styleProfile`, `aiAdapters`, `exporters`) and keep React components focused on orchestration and editing state. Use a mock provider by default so the complete workflow is verifiable without external API keys.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, jsdom, JSZip for basic DOCX parsing/export.

---

## File Structure

- Create `package.json`: scripts, dependencies, and dev dependencies.
- Create `index.html`: Vite entry point.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.setup.ts`: TypeScript and test configuration.
- Create `src/main.tsx`: React app bootstrap.
- Create `src/App.tsx`: workbench UI and state orchestration.
- Create `src/App.css`: restrained app layout and responsive behavior.
- Create `src/types.ts`: shared domain types.
- Create `src/lib/documentModel.ts`: paragraph splitting and editing helpers.
- Create `src/lib/fileParsers.ts`: `txt`, `tex`, `docx`, and basic `pdf` text extraction.
- Create `src/lib/styleProfile.ts`: reference-paper limit and style cue extraction.
- Create `src/lib/aiAdapters.ts`: provider config, prompt building, mock/local outputs, real endpoint calls.
- Create `src/lib/exporters.ts`: English-only, bilingual text, and basic DOCX export helpers.
- Create `src/lib/*.test.ts`: unit tests for each pure module.
- Create `src/App.test.tsx`: user workflow tests across import, editing, references, AI actions, and export controls.

## Task 1: Project Shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`

- [ ] **Step 1: Create project configuration**

Use Vite React TypeScript with Vitest and jsdom. Add scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview --host 127.0.0.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install @vitejs/plugin-react vite typescript react react-dom jszip lucide-react`

Run: `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom`

Expected: dependencies install successfully and `package-lock.json` is created.

- [ ] **Step 3: Create minimal React entry**

`src/main.tsx` should mount `<App />` into `#root`.

- [ ] **Step 4: Run baseline test command**

Run: `npm test -- --passWithNoTests`

Expected: command exits successfully before behavior tests exist.

## Task 2: Document Model

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/documentModel.test.ts`
- Create: `src/lib/documentModel.ts`

- [ ] **Step 1: Write failing tests**

Test paragraph splitting, stable ids, editing Chinese text, editing English text, and status transitions.

```ts
import { describe, expect, it } from "vitest";
import { createParagraphs, updateParagraphDraft, updateParagraphSource } from "./documentModel";

describe("documentModel", () => {
  it("splits manuscript text into stable paragraph records", () => {
    const paragraphs = createParagraphs("第一段。\n\n第二段。");
    expect(paragraphs).toEqual([
      expect.objectContaining({ id: "p-1", sourceZh: "第一段。", draftEn: "", status: "empty" }),
      expect.objectContaining({ id: "p-2", sourceZh: "第二段。", draftEn: "", status: "empty" })
    ]);
  });

  it("updates linked source and English draft text", () => {
    const paragraphs = createParagraphs("原文。");
    const changedSource = updateParagraphSource(paragraphs, "p-1", "修改后。");
    const changedDraft = updateParagraphDraft(changedSource, "p-1", "Revised sentence.");
    expect(changedDraft[0].sourceZh).toBe("修改后。");
    expect(changedDraft[0].draftEn).toBe("Revised sentence.");
    expect(changedDraft[0].status).toBe("edited");
    expect(changedDraft[0].history).toContain("Revised sentence.");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/documentModel.test.ts`

Expected: fails because `documentModel` does not exist.

- [ ] **Step 3: Implement document model**

Define `Paragraph` in `src/types.ts`. Implement `createParagraphs`, `updateParagraphSource`, and `updateParagraphDraft` in `src/lib/documentModel.ts`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/documentModel.test.ts`

Expected: all document model tests pass.

## Task 3: File Parsers

**Files:**
- Create: `src/lib/fileParsers.test.ts`
- Create: `src/lib/fileParsers.ts`

- [ ] **Step 1: Write failing tests**

Test text parsing, TeX cleanup, unsupported extensions, and basic PDF string extraction from a minimal byte string.

```ts
import { describe, expect, it } from "vitest";
import { cleanTex, detectFileType, extractPdfTextFromBytes, parsePlainText } from "./fileParsers";

describe("fileParsers", () => {
  it("detects supported manuscript types", () => {
    expect(detectFileType("paper.docx")).toBe("docx");
    expect(detectFileType("paper.txt")).toBe("txt");
    expect(detectFileType("paper.tex")).toBe("tex");
    expect(detectFileType("paper.pdf")).toBe("pdf");
    expect(() => detectFileType("paper.md")).toThrow("Unsupported file type");
  });

  it("keeps txt content and cleans common tex commands", () => {
    expect(parsePlainText("A\n\nB")).toBe("A\n\nB");
    expect(cleanTex("\\section{Methods}\nThis is \\textbf{important}.")).toContain("Methods");
    expect(cleanTex("\\section{Methods}\nThis is \\textbf{important}.")).toContain("This is important.");
  });

  it("extracts simple literal strings from pdf bytes", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n(Introduction) Tj\n(Methods) Tj");
    expect(extractPdfTextFromBytes(bytes)).toContain("Introduction");
    expect(extractPdfTextFromBytes(bytes)).toContain("Methods");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/fileParsers.test.ts`

Expected: fails because `fileParsers` does not exist.

- [ ] **Step 3: Implement parsers**

Implement extension detection, plain text passthrough, TeX cleanup, basic PDF literal extraction, and async file parsing. Use JSZip to parse DOCX by reading `word/document.xml` and collecting paragraph text.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/fileParsers.test.ts`

Expected: all parser tests pass.

## Task 4: Style Profile

**Files:**
- Create: `src/lib/styleProfile.test.ts`
- Create: `src/lib/styleProfile.ts`

- [ ] **Step 1: Write failing tests**

Test the 10-paper limit, word counts, phrase extraction, term extraction, and brief generation.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/styleProfile.test.ts`

Expected: fails because `styleProfile` does not exist.

- [ ] **Step 3: Implement style profile**

Implement `addReferencePaper`, `buildStyleProfile`, `extractAcademicPhrases`, and `extractCandidateTerms`. Reject the 11th paper with `Reference library supports up to 10 papers`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/styleProfile.test.ts`

Expected: all style profile tests pass.

## Task 5: AI Adapters

**Files:**
- Create: `src/lib/aiAdapters.test.ts`
- Create: `src/lib/aiAdapters.ts`

- [ ] **Step 1: Write failing tests**

Test provider labels, prompt construction with style profile, mock translation, mock polishing, mock style rewrite, and failure behavior for missing endpoints.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/aiAdapters.test.ts`

Expected: fails because `aiAdapters` does not exist.

- [ ] **Step 3: Implement adapters**

Implement `runAiAction(config, request)`. For `mock`, return deterministic academic-looking output. For OpenAI-compatible/custom/google-style providers, validate endpoint/API settings and call `fetch` using one normalized request body.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/aiAdapters.test.ts`

Expected: all AI adapter tests pass.

## Task 6: Exporters

**Files:**
- Create: `src/lib/exporters.test.ts`
- Create: `src/lib/exporters.ts`

- [ ] **Step 1: Write failing tests**

Test English-only text export, bilingual aligned text export, and DOCX blob generation.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/exporters.test.ts`

Expected: fails because `exporters` does not exist.

- [ ] **Step 3: Implement exporters**

Implement `exportEnglishText`, `exportBilingualText`, `createDownload`, and `exportDocxBlob` using JSZip with minimal Word XML.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/exporters.test.ts`

Expected: all exporter tests pass.

## Task 7: Workbench UI

**Files:**
- Create: `src/App.test.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Write failing workflow tests**

Test that the UI renders import controls, split panes, provider selector, reference limit text, AI action buttons, and export buttons.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: fails because `App` UI is not implemented.

- [ ] **Step 3: Implement workbench UI**

Build the integrated workbench:

- left project rail with manuscript import, reference upload, reference count, style profile summary, export actions;
- center synchronized paragraph editor with Chinese and English textareas;
- right AI panel with provider/model/endpoint/key fields, action mode buttons, batch action, and revision notes.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/App.test.tsx`

Expected: all UI workflow tests pass.

## Task 8: Full Verification

**Files:**
- Modify: none unless verification reveals a bug.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build production bundle**

Run: `npm run build`

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 3: Start local dev server**

Run: `npm run dev -- --port 5173`

Expected: app serves at `http://127.0.0.1:5173`.

- [ ] **Step 4: Browser smoke check**

Open the local app and verify:

- import controls are visible;
- Chinese and English panes are visible;
- reference paper area shows a 0/10 limit;
- provider selector includes Mock, OpenAI-compatible, Custom endpoint, and Google-style;
- export controls are visible;
- layout fits desktop without overlapping text.

## Self-Review Notes

- Spec coverage: tasks cover import, split editing, API provider selection, AI actions, reference style learning, export, local run, and verification.
- Placeholder scan: no `TBD`, `TODO`, or "implement later" requirements remain.
- Type consistency: domain types are centralized in `src/types.ts` and referenced by module tasks.
