import { describe, expect, it } from "vitest";
import {
  buildAiPrompt,
  getProviderOptions,
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
      { value: "mock", label: "Mock local assistant" },
      { value: "openai-compatible", label: "OpenAI-compatible API" },
      { value: "custom-endpoint", label: "Custom endpoint" },
      { value: "google-style", label: "Google Translate-style endpoint" }
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
        { action: "translate", sourceZh: "我们提出一种方法。", styleProfile }
      )
    ).resolves.toMatchObject({
      text: expect.stringContaining("Academic translation")
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

  it("uses style profile cues in mock style rewrites", async () => {
    const result = await runAiAction(
      { provider: "mock", model: "local-mock" },
      { action: "style-rewrite", sourceZh: "我们进行了分析。", styleProfile }
    );

    expect(result.text).toContain("finite element analysis");
    expect(result.notes).toContain("Applied reference-paper style cues.");
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
