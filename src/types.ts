export type ParagraphStatus = "empty" | "drafted" | "edited" | "accepted";

export type Paragraph = {
  id: string;
  sourceZh: string;
  draftEn: string;
  status: ParagraphStatus;
  notes: string[];
  history: string[];
};
