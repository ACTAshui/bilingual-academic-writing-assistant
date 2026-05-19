import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAiPrompt,
  getProviderOptions,
  getQuickTranslationOptions,
  runQuickTranslation,
  runAiAction
} from "./aiAdapters";
import type { StyleProfile } from "../types";

describe("aiAdapters", () => {
  const styleProfile: StyleProfile = {
    referenceCount: 2,
    phrases: ["experimental results demonstrate"],
    terms: ["finite element analysis"],
    brief:
      "Use field-specific terminology from 2 reference papers. Prefer terms such as finite element analysis."
  };

  it("exposes selectable provider options", () => {
    expect(getProviderOptions()).toEqual([
      { value: "anthropic", label: "Anthropic Claude" },
      { value: "baidu-qianfan", label: "Baidu Qianfan（文心）" },
      { value: "custom-endpoint", label: "Custom API（自定义）" },
      { value: "deepseek", label: "DeepSeek API" },
      { value: "google-gemini", label: "Google Gemini" },
      { value: "groq", label: "Groq" },
      { value: "minimax", label: "MiniMax" },
      { value: "mistral", label: "Mistral" },
      { value: "moonshot", label: "Moonshot Kimi" },
      { value: "mock", label: "Mock Local（演示）" },
      { value: "openai", label: "OpenAI" },
      { value: "openrouter", label: "OpenRouter" },
      { value: "qwen", label: "Qwen DashScope（通义千问）" },
      { value: "siliconflow", label: "SiliconFlow" },
      { value: "stepfun", label: "StepFun" },
      { value: "tencent-hunyuan", label: "Tencent Hunyuan（混元）" },
      { value: "volcengine-ark", label: "Volcengine Ark（豆包）" },
      { value: "xai", label: "xAI Grok" },
      { value: "zhipu", label: "Zhipu GLM（智谱）" }
    ]);
  });

  it("exposes quick translation providers", () => {
    expect(getQuickTranslationOptions()).toEqual([
      { value: "google-public", label: "Google 公共快速翻译（免密）" },
      { value: "mymemory", label: "MyMemory 快速翻译（免密备用）" }
    ]);
  });

  it("builds prompts that include action, source, draft, and style profile", () => {
    const prompt = buildAiPrompt({
      action: "style-rewrite",
      sourceZh: "本文提出一种有限元方法。",
      draftEn: "This paper proposes a method.",
      styleProfile
    });

    expect(prompt).toContain("Task: style-rewrite");
    expect(prompt).toContain("本文提出一种有限元方法。");
    expect(prompt).toContain("This paper proposes a method.");
    expect(prompt).toContain("finite element analysis");
  });

  it("returns deterministic mock translation and polishing results", async () => {
    await expect(
      runAiAction(
        { provider: "mock", model: "local-mock" },
        {
          action: "translate",
          sourceText: "我们提出一种方法。",
          targetLanguage: "en",
          styleProfile
        }
      )
    ).resolves.toMatchObject({
      text: expect.stringContaining("Academic translation")
    });

    await expect(
      runAiAction(
        { provider: "mock", model: "local-mock" },
        {
          action: "translate",
          sourceText: "This study proposes a robust framework.",
          targetLanguage: "zh",
          styleProfile
        }
      )
    ).resolves.toMatchObject({
      text: expect.stringContaining("中文学术译文")
    });

    await expect(
      runAiAction(
        { provider: "mock", model: "local-mock" },
        { action: "polish", sourceZh: "我们提出一种方法。", draftEn: "We propose method." }
      )
    ).resolves.toMatchObject({
      text: expect.stringContaining("Polished academic version")
    });
  });

  it("uses the public online translation provider for real Chinese output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          responseData: {
            translatedText: "本研究提出了一种稳健的框架。"
          },
          responseStatus: 200
        })
      )
    );

    await expect(
      runAiAction(
        { provider: "google-style", model: "online-translate" },
        {
          action: "translate",
          sourceText: "This study proposes a robust framework.",
          targetLanguage: "zh"
        }
      )
    ).resolves.toMatchObject({
      text: "本研究提出了一种稳健的框架。",
      notes: expect.stringContaining("在线翻译接口")
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("langpair=en%7Czh-CN")
    );
  });

  it("runs quick Google-style translation without the LLM prompt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          [["This study proposes a robust framework.", "本研究提出了一种稳健的框架。"]]
        ])
      )
    );

    await expect(
      runQuickTranslation({
        provider: "google-public",
        sourceText: "本研究提出了一种稳健的框架。",
        targetLanguage: "en"
      })
    ).resolves.toMatchObject({
      text: "This study proposes a robust framework.",
      notes: expect.stringContaining("Google")
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("translate.googleapis.com")
    );
  });

  it("normalizes DeepSeek base URL to chat completions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: "本研究提出了一种稳健的框架。" } }]
        })
      )
    );

    await expect(
      runAiAction(
        {
          provider: "deepseek",
          model: "deepseek-v4-pro",
          endpoint: "https://api.deepseek.com",
          apiKey: "sk-test"
        },
        {
          action: "translate",
          sourceText: "This study proposes a robust framework.",
          targetLanguage: "zh"
        }
      )
    ).resolves.toMatchObject({
      text: "本研究提出了一种稳健的框架。"
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test"
        })
      })
    );
  });

  it("uses style profile cues in mock style rewrites", async () => {
    const result = await runAiAction(
      { provider: "mock", model: "local-mock" },
      { action: "style-rewrite", sourceZh: "我们进行了分析。", styleProfile }
    );

    expect(result.text).toContain("finite element analysis");
    expect(result.notes).toContain("已应用参考论文");
  });

  it("rejects real provider calls without endpoint settings", async () => {
    await expect(
      runAiAction(
        { provider: "custom-endpoint", model: "writer" },
        { action: "translate", sourceZh: "测试。" }
      )
    ).rejects.toThrow("Endpoint is required");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
