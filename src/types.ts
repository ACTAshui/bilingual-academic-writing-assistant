export type ParagraphStatus = "empty" | "drafted" | "edited" | "accepted";
export type TextLanguage = "zh" | "en" | "mixed" | "empty";
export type EditSide = "zh" | "en";

export type ParagraphNote = {
  side: EditSide;
  text: string;
};

export type Paragraph = {
  id: string;
  sourceZh: string;
  draftEn: string;
  detectedLanguage: TextLanguage;
  status: ParagraphStatus;
  notes: ParagraphNote[];
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
  | "anthropic"
  | "baidu-qianfan"
  | "mock"
  | "deepseek"
  | "google-gemini"
  | "groq"
  | "minimax"
  | "mistral"
  | "moonshot"
  | "openai"
  | "openrouter"
  | "qwen"
  | "siliconflow"
  | "stepfun"
  | "tencent-hunyuan"
  | "volcengine-ark"
  | "xai"
  | "zhipu"
  | "custom-endpoint"
  | "openai-compatible"
  | "google-style";

export type QuickTranslationProvider = "google-public" | "mymemory";

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
  sourceZh?: string;
  sourceText?: string;
  draftEn?: string;
  targetLanguage?: "zh" | "en";
  styleProfile?: StyleProfile;
};

export type AiResult = {
  text: string;
  notes: string;
};
