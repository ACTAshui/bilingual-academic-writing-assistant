import type {
  EditSide,
  Paragraph,
  ParagraphNote,
  ParagraphStatus,
  TextLanguage
} from "../types";

const lineBreak = /\n+/;
const cjkRegex = /\p{Script=Han}/gu;
const latinLetterRegex = /[A-Za-z]/g;
const englishWordRegex = /[A-Za-z]+(?:[-'][A-Za-z]+)?/g;
const englishAbbreviations = new Set([
  "al",
  "dr",
  "e.g",
  "etc",
  "fig",
  "i.e",
  "mr",
  "mrs",
  "ms",
  "prof",
  "vs"
]);

export function detectTextLanguage(text: string): TextLanguage {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return "empty";

  const cjkCount = compact.match(cjkRegex)?.length ?? 0;
  const latinCount = compact.match(latinLetterRegex)?.length ?? 0;
  const englishWordCount = text.match(englishWordRegex)?.length ?? 0;
  const totalScriptCount = cjkCount + latinCount;

  if (totalScriptCount === 0) return "empty";
  if (cjkCount >= 2 && latinCount === 0) return "zh";
  if (cjkCount === 0 && latinCount >= 2 && englishWordCount >= 1) return "en";

  const cjkRatio = cjkCount / totalScriptCount;
  if (cjkCount >= 4 && cjkRatio >= 0.35) return "zh";
  if (cjkCount >= 2 && latinCount > 0) return "mixed";
  if (englishWordCount >= 3 && cjkRatio <= 0.1) return "en";

  return "mixed";
}

export function createParagraphs(text: string): Paragraph[] {
  return splitTextIntoSegments(text)
    .map((content, index) => {
      const detectedLanguage = detectTextLanguage(content);
      const isEnglish = detectedLanguage === "en";

      return createParagraph({
        id: `p-${index + 1}`,
        sourceZh: isEnglish ? "" : content,
        draftEn: isEnglish ? content : "",
        detectedLanguage
      });
    });
}

export function createSingleParagraph(text: string): Paragraph[] {
  const content = text.replace(/\r\n/g, "\n").trim();
  if (!content) return [];

  const detectedLanguage = detectTextLanguage(content);
  const isEnglish = detectedLanguage === "en";

  return [
    createParagraph({
      id: "p-1",
      sourceZh: isEnglish ? "" : content,
      draftEn: isEnglish ? content : "",
      detectedLanguage
    })
  ];
}

export function splitTextIntoSegments(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .flatMap((block) =>
      mergeWrappedAcademicLines(block).flatMap((logicalBlock) =>
        splitBlockIntoSentences(logicalBlock)
      )
    )
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function replaceParagraphWithSegments(
  paragraphs: Paragraph[],
  id: string,
  side: EditSide,
  segments: string[]
): Paragraph[] {
  const targetIndex = paragraphs.findIndex((paragraph) => paragraph.id === id);
  const cleanSegments = segments.map((segment) => segment.trim()).filter(Boolean);
  if (targetIndex === -1 || cleanSegments.length === 0) return paragraphs;

  const replacement = cleanSegments.map((segment) =>
    createParagraph({
      id: "",
      sourceZh: side === "zh" ? segment : "",
      draftEn: side === "en" ? segment : ""
    })
  );

  return reindexParagraphs([
    ...paragraphs.slice(0, targetIndex),
    ...replacement,
    ...paragraphs.slice(targetIndex + 1)
  ]);
}

export function getParagraph(paragraphs: Paragraph[], id: string) {
  return paragraphs.find((paragraph) => paragraph.id === id);
}

export function updateParagraphSource(
  paragraphs: Paragraph[],
  id: string,
  sourceZh: string
): Paragraph[] {
  return updateParagraphPair(paragraphs, id, { sourceZh });
}

export function updateParagraphDraft(
  paragraphs: Paragraph[],
  id: string,
  draftEn: string
): Paragraph[] {
  return updateParagraphPair(paragraphs, id, { draftEn });
}

export function updateParagraphNotes(
  paragraphs: Paragraph[],
  id: string,
  notes: ParagraphNote[]
): Paragraph[] {
  return paragraphs.map((paragraph) =>
    paragraph.id === id ? { ...paragraph, notes } : paragraph
  );
}

export function updateParagraphPair(
  paragraphs: Paragraph[],
  id: string,
  values: Partial<Pick<Paragraph, "sourceZh" | "draftEn">>
): Paragraph[] {
  return paragraphs.map((paragraph) => {
    if (paragraph.id !== id) return paragraph;

    const sourceZh = values.sourceZh ?? paragraph.sourceZh;
    const draftEn = values.draftEn ?? paragraph.draftEn;
    const draftChanged =
      values.draftEn !== undefined && values.draftEn !== paragraph.draftEn;

    return createParagraph({
      ...paragraph,
      sourceZh,
      draftEn,
      history:
        draftChanged && draftEn.trim()
          ? [...paragraph.history, draftEn]
          : paragraph.history,
      notes: paragraph.notes
    });
  });
}

export function clearParagraph(paragraph: Paragraph): Paragraph {
  return createParagraph({
    ...paragraph,
    sourceZh: "",
    draftEn: "",
    detectedLanguage: "empty",
    notes: [],
    history: []
  });
}

function createParagraph(
  input: Pick<Paragraph, "id" | "sourceZh" | "draftEn"> &
    Partial<Pick<Paragraph, "notes" | "history" | "detectedLanguage">>
): Paragraph {
  const detectedLanguage =
    input.detectedLanguage ?? detectParagraphLanguage(input.sourceZh, input.draftEn);

  return {
    id: input.id,
    sourceZh: input.sourceZh,
    draftEn: input.draftEn,
    detectedLanguage,
    status: getParagraphStatus(input.sourceZh, input.draftEn),
    notes: input.notes ?? [],
    history: input.history ?? []
  };
}

function reindexParagraphs(paragraphs: Paragraph[]): Paragraph[] {
  return paragraphs.map((paragraph, index) => ({
    ...paragraph,
    id: `p-${index + 1}`
  }));
}

function detectParagraphLanguage(sourceZh: string, draftEn: string): TextLanguage {
  const sourceLanguage = detectTextLanguage(sourceZh);
  if (sourceLanguage !== "empty") return sourceLanguage;
  return detectTextLanguage(draftEn);
}

function getParagraphStatus(sourceZh: string, draftEn: string): ParagraphStatus {
  if (sourceZh.trim() && draftEn.trim()) return "edited";
  if (draftEn.trim()) return "drafted";
  return "empty";
}

function splitBlockIntoSentences(block: string): string[] {
  const compact = block.replace(/[ \t]+/g, " ").trim();
  if (!compact) return [];
  if (isShortAcademicHeading(compact)) return [compact];

  const segments: string[] = [];
  let start = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (!isSentenceBoundary(compact, index)) continue;

    const segment = compact.slice(start, index + 1).trim();
    if (segment) segments.push(segment);
    start = index + 1;
  }

  const tail = compact.slice(start).trim();
  if (tail) segments.push(tail);
  return segments.length > 0 ? segments : [compact];
}

function mergeWrappedAcademicLines(block: string): string[] {
  const lines = block
    .split(lineBreak)
    .map((line) => line.trim())
    .filter(Boolean);
  const logicalBlocks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (isShortAcademicHeading(line)) {
      if (current) logicalBlocks.push(current);
      logicalBlocks.push(line);
      current = "";
      continue;
    }

    current = current ? `${current} ${line}` : line;
  }

  if (current) logicalBlocks.push(current);
  return logicalBlocks;
}

function isShortAcademicHeading(text: string): boolean {
  if (/[。！？；!?;]$/.test(text)) return false;
  if (/^\d+(?:\.\d+)*\.\s+\S+/.test(text) && text.length <= 90) return true;
  return /^(?:abstract|introduction|methods?|results?|discussion|conclusion|references)$/i.test(text);
}

function isSentenceBoundary(text: string, index: number): boolean {
  const char = text[index];
  if ("。！？；".includes(char)) return true;
  if (!".!?;".includes(char)) return false;
  if (char === "." && isProtectedPeriod(text, index)) return false;

  const next = text[index + 1];
  return next === undefined || /\s|["')\]]/.test(next);
}

function isProtectedPeriod(text: string, index: number): boolean {
  const previous = text[index - 1];
  const next = text[index + 1];
  if (/\d/.test(previous ?? "") && /\d/.test(next ?? "")) return true;

  const prefix = text.slice(0, index).trim();
  if (/^\d+(?:\.\d+)*$/.test(prefix)) return true;

  const abbreviation = prefix.match(/[A-Za-z]+(?:\.[A-Za-z]+)?$/)?.[0].toLowerCase();
  return abbreviation ? englishAbbreviations.has(abbreviation) : false;
}
