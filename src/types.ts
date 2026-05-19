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

export type AiProvider =
  | "mock"
  | "openai-compatible"
  | "custom-endpoint"
  | "google-style";

export type AiAction =
  | "translate"
  | "polish"
  | "style-rewrite"
  | "explain";

export type AiProviderConfig = {
  provider: AiProvider;
  model: string;
  endpoint?: string;
  apiKey?: string;
};

export type AiRequest = {
  action: AiAction;
  sourceZh: string;
  draftEn?: string;
  styleProfile?: StyleProfile;
};

export type AiResult = {
  text: string;
  notes: string;
};
