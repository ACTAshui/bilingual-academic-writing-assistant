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

export type ReferencePaper = {
  id: string;
  name: string;
  type: SupportedFileType;
  text: string;
  wordCount: number;
  status: "ready" | "error";
};

export type StyleProfile = {
  referenceCount: number;
  phrases: string[];
  terms: string[];
  brief: string;
};
