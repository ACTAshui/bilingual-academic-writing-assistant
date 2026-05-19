export type ParagraphStatus = "empty" | "drafted" | "edited" | "accepted";

export type Paragraph = {
  id: string;
  sourceZh: string;
  draftEn: string;
  status: ParagraphStatus;
  notes: string[];
  history: string[];
};

export type SupportedFileType = "pdf" | "docx" | "txt" | "tex";

export type ParsedFile = {
  name: string;
  type: SupportedFileType;
  text: string;
};
