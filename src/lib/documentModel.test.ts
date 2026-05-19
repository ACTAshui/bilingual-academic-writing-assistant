import { describe, expect, it } from "vitest";
import {
  createParagraphs,
  detectTextLanguage,
  getParagraph,
  splitTextIntoSegments,
  updateParagraphDraft,
  updateParagraphSource
} from "./documentModel";

describe("documentModel", () => {
  it("splits manuscript text into stable paragraph records", () => {
    const paragraphs = createParagraphs("第一段。\n\n第二段。");

    expect(paragraphs).toEqual([
      expect.objectContaining({
        id: "p-1",
        sourceZh: "第一段。",
        draftEn: "",
        detectedLanguage: "zh",
        status: "empty"
      }),
      expect.objectContaining({
        id: "p-2",
        sourceZh: "第二段。",
        draftEn: "",
        detectedLanguage: "zh",
        status: "empty"
      })
    ]);
  });

  it("puts imported English paragraphs into the English pane", () => {
    const paragraphs = createParagraphs(
      "This study proposes a graph neural network for fatigue analysis."
    );

    expect(paragraphs[0]).toEqual(
      expect.objectContaining({
        sourceZh: "",
        draftEn: "This study proposes a graph neural network for fatigue analysis.",
        detectedLanguage: "en",
        status: "drafted"
      })
    );
  });

  it("puts concise English headings and titles into the English pane", () => {
    const paragraphs = createParagraphs(
      "Abstract\n\n1. Introduction\n\nPhysics-Coupled Machine Learning for Metal Fatigue"
    );

    expect(paragraphs).toEqual([
      expect.objectContaining({
        sourceZh: "",
        draftEn: "Abstract",
        detectedLanguage: "en"
      }),
      expect.objectContaining({
        sourceZh: "",
        draftEn: "1. Introduction",
        detectedLanguage: "en"
      }),
      expect.objectContaining({
        sourceZh: "",
        draftEn: "Physics-Coupled Machine Learning for Metal Fatigue",
        detectedLanguage: "en"
      })
    ]);
  });

  it("splits imported text by sentence punctuation and line breaks", () => {
    expect(
      splitTextIntoSegments(
        "第一句。第二句。\n\nThird sentence. Fourth sentence.\n1. Introduction"
      )
    ).toEqual([
      "第一句。",
      "第二句。",
      "Third sentence.",
      "Fourth sentence.",
      "1. Introduction"
    ]);
  });

  it("merges wrapped academic lines before sentence segmentation", () => {
    expect(
      splitTextIntoSegments(
        "Total life, initiation, crack\ngrowth, and remaining-life updating expose different states\nand permit different engineering claims. This review focuses on fatigue prediction."
      )
    ).toEqual([
      "Total life, initiation, crack growth, and remaining-life updating expose different states and permit different engineering claims.",
      "This review focuses on fatigue prediction."
    ]);
  });

  it("strictly distinguishes Chinese, English, and mixed academic text", () => {
    expect(detectTextLanguage("本文提出一种新的有限元分析方法。")).toBe("zh");
    expect(
      detectTextLanguage("Experimental results demonstrate robust performance.")
    ).toBe("en");
    expect(detectTextLanguage("This method 显著 improves robustness.")).toBe(
      "mixed"
    );
  });

  it("ignores blank paragraphs and trims each paragraph", () => {
    const paragraphs = createParagraphs("  摘要。  \n\n\n  方法。  ");

    expect(paragraphs.map((paragraph) => paragraph.sourceZh)).toEqual([
      "摘要。",
      "方法。"
    ]);
  });

  it("updates linked source and English draft text", () => {
    const paragraphs = createParagraphs("原文。");
    const changedSource = updateParagraphSource(paragraphs, "p-1", "修改后。");
    const changedDraft = updateParagraphDraft(
      changedSource,
      "p-1",
      "Revised sentence."
    );

    expect(changedDraft[0].sourceZh).toBe("修改后。");
    expect(changedDraft[0].draftEn).toBe("Revised sentence.");
    expect(changedDraft[0].status).toBe("edited");
    expect(changedDraft[0].history).toContain("Revised sentence.");
  });

  it("returns the selected paragraph by id", () => {
    const paragraphs = createParagraphs("第一段。\n\n第二段。");

    expect(getParagraph(paragraphs, "p-2")?.sourceZh).toBe("第二段。");
    expect(getParagraph(paragraphs, "missing")).toBeUndefined();
  });
});
