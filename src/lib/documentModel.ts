import type { Paragraph } from "../types";

const paragraphBreak = /\n\s*\n+/;

export function createParagraphs(text: string): Paragraph[] {
  return text
    .split(paragraphBreak)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((sourceZh, index) => ({
      id: `p-${index + 1}`,
      sourceZh,
      draftEn: "",
      status: "empty",
      notes: [],
      history: []
    }));
}

export function getParagraph(paragraphs: Paragraph[], id: string) {
  return paragraphs.find((paragraph) => paragraph.id === id);
}

export function updateParagraphSource(
  paragraphs: Paragraph[],
  id: string,
  sourceZh: string
): Paragraph[] {
  return paragraphs.map((paragraph) =>
    paragraph.id === id
      ? {
          ...paragraph,
          sourceZh,
          status: paragraph.draftEn.trim() ? "edited" : "empty"
        }
      : paragraph
  );
}

export function updateParagraphDraft(
  paragraphs: Paragraph[],
  id: string,
  draftEn: string
): Paragraph[] {
  return paragraphs.map((paragraph) =>
    paragraph.id === id
      ? {
          ...paragraph,
          draftEn,
          status: draftEn.trim() ? "edited" : "empty",
          history: draftEn.trim()
            ? [...paragraph.history, draftEn]
            : paragraph.history
        }
      : paragraph
  );
}
