import type {
  AiProvider,
  AiProviderConfig,
  AiRequest,
  AiResult,
  QuickTranslationProvider
} from "../types";

type ProviderProtocol =
  | "anthropic"
  | "custom"
  | "gemini"
  | "mock"
  | "openai-chat"
  | "public-translation";

type ProviderPreset = {
  value: AiProvider;
  label: string;
  defaultEndpoint: string;
  defaultModel: string;
  protocol: ProviderProtocol;
};

type QuickTranslationRequest = {
  provider: QuickTranslationProvider;
  sourceText: string;
  targetLanguage: "zh" | "en";
};

const providerPresets: Record<AiProvider, ProviderPreset> = {
  anthropic: {
    value: "anthropic",
    label: "Anthropic Claude",
    defaultEndpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-20250514",
    protocol: "anthropic"
  },
  "baidu-qianfan": {
    value: "baidu-qianfan",
    label: "Baidu Qianfan（文心）",
    defaultEndpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-4.5-turbo-128k",
    protocol: "openai-chat"
  },
  "custom-endpoint": {
    value: "custom-endpoint",
    label: "Custom API（自定义）",
    defaultEndpoint: "",
    defaultModel: "custom-model",
    protocol: "custom"
  },
  deepseek: {
    value: "deepseek",
    label: "DeepSeek API",
    defaultEndpoint: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    protocol: "openai-chat"
  },
  "google-gemini": {
    value: "google-gemini",
    label: "Google Gemini",
    defaultEndpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    defaultModel: "gemini-2.5-pro",
    protocol: "gemini"
  },
  groq: {
    value: "groq",
    label: "Groq",
    defaultEndpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    protocol: "openai-chat"
  },
  minimax: {
    value: "minimax",
    label: "MiniMax",
    defaultEndpoint: "https://api.minimaxi.com/v1/text/chatcompletion_v2",
    defaultModel: "M2-her",
    protocol: "openai-chat"
  },
  mistral: {
    value: "mistral",
    label: "Mistral",
    defaultEndpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    protocol: "openai-chat"
  },
  moonshot: {
    value: "moonshot",
    label: "Moonshot Kimi",
    defaultEndpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2.5",
    protocol: "openai-chat"
  },
  mock: {
    value: "mock",
    label: "Mock Local（演示）",
    defaultEndpoint: "",
    defaultModel: "local-mock",
    protocol: "mock"
  },
  openai: {
    value: "openai",
    label: "OpenAI",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4.1",
    protocol: "openai-chat"
  },
  openrouter: {
    value: "openrouter",
    label: "OpenRouter",
    defaultEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-4.1",
    protocol: "openai-chat"
  },
  qwen: {
    value: "qwen",
    label: "Qwen DashScope（通义千问）",
    defaultEndpoint:
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-plus",
    protocol: "openai-chat"
  },
  siliconflow: {
    value: "siliconflow",
    label: "SiliconFlow",
    defaultEndpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "Qwen/Qwen3-235B-A22B",
    protocol: "openai-chat"
  },
  stepfun: {
    value: "stepfun",
    label: "StepFun",
    defaultEndpoint: "https://api.stepfun.com/v1/chat/completions",
    defaultModel: "step-3.5-flash",
    protocol: "openai-chat"
  },
  "tencent-hunyuan": {
    value: "tencent-hunyuan",
    label: "Tencent Hunyuan（混元）",
    defaultEndpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-turbos-latest",
    protocol: "openai-chat"
  },
  "volcengine-ark": {
    value: "volcengine-ark",
    label: "Volcengine Ark（豆包）",
    defaultEndpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-1-6-251015",
    protocol: "openai-chat"
  },
  xai: {
    value: "xai",
    label: "xAI Grok",
    defaultEndpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4",
    protocol: "openai-chat"
  },
  zhipu: {
    value: "zhipu",
    label: "Zhipu GLM（智谱）",
    defaultEndpoint: "https://api.z.ai/api/paas/v4/chat/completions",
    defaultModel: "glm-4.5",
    protocol: "openai-chat"
  },
  "openai-compatible": {
    value: "openai-compatible",
    label: "OpenAI Compatible（兼容旧版）",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4.1",
    protocol: "openai-chat"
  },
  "google-style": {
    value: "google-style",
    label: "Online Translator（限流旧版）",
    defaultEndpoint: "",
    defaultModel: "online-translate",
    protocol: "public-translation"
  }
};

const visibleProviderIds: AiProvider[] = [
  "anthropic",
  "baidu-qianfan",
  "custom-endpoint",
  "deepseek",
  "google-gemini",
  "groq",
  "minimax",
  "mistral",
  "moonshot",
  "mock",
  "openai",
  "openrouter",
  "qwen",
  "siliconflow",
  "stepfun",
  "tencent-hunyuan",
  "volcengine-ark",
  "xai",
  "zhipu"
];

const quickTranslationOptions: Array<{
  value: QuickTranslationProvider;
  label: string;
}> = [
  { value: "google-public", label: "Google 公共快速翻译（免密）" },
  { value: "mymemory", label: "MyMemory 快速翻译（免密备用）" }
];

export function getProviderOptions() {
  return visibleProviderIds.map((value) => ({
    value,
    label: providerPresets[value].label
  }));
}

export function getQuickTranslationOptions() {
  return quickTranslationOptions;
}

export function getProviderPreset(provider: AiProvider) {
  return providerPresets[provider];
}

export function buildAiPrompt(request: AiRequest): string {
  const sourceText = getRequestSourceText(request);
  const targetLanguage =
    request.targetLanguage === "zh" ? "Chinese" : "English";

  return [
    `Task: ${request.action}`,
    "You are assisting with bilingual academic manuscript writing.",
    `Target language: ${targetLanguage}`,
    request.styleProfile?.brief
      ? `Reference style brief: ${request.styleProfile.brief}`
      : "Reference style brief: none loaded.",
    request.styleProfile?.phrases.length
      ? `Useful phrases: ${request.styleProfile.phrases.join("; ")}`
      : "",
    request.styleProfile?.terms.length
      ? `Terminology: ${request.styleProfile.terms.join("; ")}`
      : "",
    `Source text: ${sourceText}`,
    request.sourceZh ? `Current Chinese pane: ${request.sourceZh}` : "",
    request.draftEn ? `Current English pane: ${request.draftEn}` : "",
    "Return only the revised or translated manuscript text, followed by a short revision note if the API format supports it."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runAiAction(
  config: AiProviderConfig,
  request: AiRequest
): Promise<AiResult> {
  if (config.provider === "mock") {
    return runMockAction(request);
  }

  if (config.provider === "google-style") {
    return runPublicTranslationAction(request);
  }

  const preset = getProviderPreset(config.provider);
  const endpoint = resolveProviderEndpoint(config, preset);

  if (!endpoint) {
    throw new Error("Endpoint is required");
  }

  if (!config.apiKey && preset.protocol !== "custom") {
    throw new Error("API key is required");
  }

  const prompt = buildAiPrompt(request);
  if (preset.protocol === "anthropic") {
    return runAnthropicAction(endpoint, config, prompt);
  }
  if (preset.protocol === "gemini") {
    return runGeminiAction(endpoint, config, prompt);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      ...(preset.protocol === "custom" ? { input: prompt } : {}),
      ...(preset.protocol === "custom" ? {} : { stream: false })
    })
  });

  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.output_text ??
    data?.text ??
    "";

  return {
    text: String(text).trim(),
    notes: "已由所选 API 生成。"
  };
}

export async function runQuickTranslation(
  request: QuickTranslationRequest
): Promise<AiResult> {
  const sourceText = request.sourceText.trim();
  if (!sourceText) {
    return {
      text: "",
      notes: "没有可快速翻译的内容。"
    };
  }

  if (request.provider === "google-public") {
    return runGooglePublicTranslation(sourceText, request.targetLanguage);
  }

  return runMyMemoryTranslation(sourceText, request.targetLanguage, "MyMemory");
}

async function runAnthropicAction(
  endpoint: string,
  config: AiProviderConfig,
  prompt: string
): Promise<AiResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": config.apiKey ?? ""
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.content
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join("\n") ?? "";

  return {
    text: String(text).trim(),
    notes: "已由所选 API 生成。"
  };
}

async function runGeminiAction(
  endpoint: string,
  config: AiProviderConfig,
  prompt: string
): Promise<AiResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey ?? ""
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join("\n") ?? "";

  return {
    text: String(text).trim(),
    notes: "已由所选 API 生成。"
  };
}

function resolveProviderEndpoint(
  config: AiProviderConfig,
  preset: ProviderPreset
): string | undefined {
  const endpoint = config.endpoint?.trim() || preset.defaultEndpoint;
  if (!endpoint) return endpoint;

  if (preset.protocol === "gemini") {
    return endpoint.replace("{model}", encodeURIComponent(config.model));
  }

  if (preset.protocol === "openai-chat") {
    return normalizeChatCompletionsEndpoint(endpoint);
  }

  return endpoint;
}

function normalizeChatCompletionsEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname.endsWith("/chat/completions")) {
      url.pathname = pathname;
      return url.toString();
    }
    if (pathname === "" || pathname === "/" || pathname === "/v1" || pathname === "/beta") {
      url.pathname =
        pathname === "" || pathname === "/"
          ? "/chat/completions"
          : `${pathname}/chat/completions`;
      return url.toString();
    }
  } catch {
    if (!trimmed.endsWith("/chat/completions")) {
      return `${trimmed}/chat/completions`;
    }
  }

  return trimmed;
}

async function runPublicTranslationAction(request: AiRequest): Promise<AiResult> {
  if (request.action !== "translate") {
    return runMockAction(request);
  }

  const sourceText = getRequestSourceText(request).trim();
  if (!sourceText) {
    return {
      text: "",
      notes: "没有可翻译的内容。"
    };
  }

  return runMyMemoryTranslation(
    sourceText,
    request.targetLanguage === "zh" ? "zh" : "en",
    "在线翻译接口"
  );
}

async function runGooglePublicTranslation(
  sourceText: string,
  targetLanguage: "zh" | "en"
): Promise<AiResult> {
  const target = targetLanguage === "zh" ? "zh-CN" : "en";
  const query = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: target,
    dt: "t",
    q: sourceText
  });
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${query.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Google 快速翻译失败：${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.[0]
      ?.map((part: unknown[]) => part?.[0])
      .filter(Boolean)
      .join("") ?? "";

  if (!text) {
    throw new Error("Google 快速翻译没有返回译文");
  }

  return {
    text: decodeHtmlEntities(String(text).trim()),
    notes: "已通过 Google 公共快速翻译生成译文。"
  };
}

async function runMyMemoryTranslation(
  sourceText: string,
  targetLanguage: "zh" | "en",
  label: string
): Promise<AiResult> {
  const sourceLanguage = targetLanguage === "zh" ? "en" : "zh-CN";
  const target = targetLanguage === "zh" ? "zh-CN" : "en";
  const chunks = splitTranslationText(sourceText, 450);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const query = new URLSearchParams({
      q: chunk,
      langpair: `${sourceLanguage}|${target}`
    });
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${query.toString()}`
    );

    if (!response.ok) {
      throw new Error(`在线翻译接口请求失败：${response.status}`);
    }

    const data = await response.json();
    const translatedText = data?.responseData?.translatedText;
    if (!translatedText || data?.responseStatus >= 400) {
      throw new Error(data?.responseDetails || "在线翻译接口没有返回译文");
    }

    translatedChunks.push(decodeHtmlEntities(String(translatedText)));
  }

  return {
    text: translatedChunks.join("\n\n"),
    notes: `已通过${label}生成译文。`
  };
}

function runMockAction(request: AiRequest): AiResult {
  const primaryTerm = request.styleProfile?.terms[0] ?? "the proposed method";
  const sourceSummary = getRequestSourceText(request)
    .replace(/\s+/g, " ")
    .slice(0, 120);

  if (request.action === "polish") {
    return {
      text: `Polished academic version: ${request.draftEn ?? sourceSummary}`,
      notes: "已提升清晰度、简洁度和学术语气。"
    };
  }

  if (request.action === "style-rewrite") {
    return {
      text: `In line with the reference corpus, ${primaryTerm} is presented with concise academic phrasing.`,
      notes: "已应用参考论文的句式和用词线索。"
    };
  }

  if (request.action === "explain") {
    return {
      text: "The revision favors precise terminology, active claims, and compact academic sentence structure.",
      notes: "已解释本次修改的术语、主张和句式选择。"
    };
  }

  if (request.targetLanguage === "zh") {
    return {
      text: `中文学术译文：${sourceSummary}`,
      notes: request.styleProfile?.referenceCount
        ? "已结合参考论文术语线索翻译为中文。"
        : "已使用通用学术表达翻译为中文。"
    };
  }

  return {
    text: `Academic translation: ${sourceSummary}`,
    notes: request.styleProfile?.referenceCount
      ? "已结合参考论文术语线索翻译为英文。"
      : "已使用通用学术表达翻译为英文。"
  };
}

function getRequestSourceText(request: AiRequest): string {
  return request.sourceText ?? request.sourceZh ?? request.draftEn ?? "";
}

function splitTranslationText(text: string, maxLength: number): string[] {
  const units =
    text.match(/[^。！？.!?\n]+[。！？.!?]?|\n+/g)?.map((unit) => unit.trim()) ??
    [text];
  const chunks: string[] = [];
  let current = "";

  for (const unit of units.filter(Boolean)) {
    if (unit.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < unit.length; index += maxLength) {
        chunks.push(unit.slice(index, index + maxLength));
      }
      continue;
    }

    const next = current ? `${current} ${unit}` : unit;
    if (next.length > maxLength) {
      chunks.push(current);
      current = unit;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
