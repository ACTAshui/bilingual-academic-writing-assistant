import { describe, expect, it } from "vitest";
import {
  createParagraphs,
  getParagraph,
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
        status: "empty"
      }),
      expect.objectContaining({
        id: "p-2",
        sourceZh: "第二段。",
        draftEn: "",
        status: "empty"
      })
    ]);
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
