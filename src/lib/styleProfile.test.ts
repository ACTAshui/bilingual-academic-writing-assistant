import { describe, expect, it } from "vitest";
import {
  addReferencePaper,
  buildStyleProfile,
  extractAcademicPhrases,
  extractCandidateTerms
} from "./styleProfile";

describe("styleProfile", () => {
  const referenceText =
    "The proposed framework significantly improves classification accuracy. " +
    "Experimental results demonstrate that the proposed method is robust. " +
    "Finite element analysis and convolutional neural network models were used.";

  it("adds reference papers with word counts and rejects the eleventh paper", () => {
    const references = Array.from({ length: 10 }).reduce(
      (items, _, index) =>
        addReferencePaper(items, {
          name: `ref-${index + 1}.txt`,
          type: "txt",
          text: referenceText
        }),
      [] as ReturnType<typeof addReferencePaper>
    );

    expect(references).toHaveLength(10);
    expect(references[0]).toMatchObject({
      id: "ref-1",
      name: "ref-1.txt",
      type: "txt",
      status: "ready"
    });
    expect(references[0].wordCount).toBeGreaterThan(10);
    expect(() =>
      addReferencePaper(references, {
        name: "ref-11.txt",
        type: "txt",
        text: referenceText
      })
    ).toThrow("Reference library supports up to 10 papers");
  });

  it("extracts academic phrases and candidate terms", () => {
    expect(extractAcademicPhrases(referenceText)).toContain(
      "the proposed framework"
    );
    expect(extractAcademicPhrases(referenceText)).toContain(
      "experimental results demonstrate"
    );
    expect(extractCandidateTerms(referenceText)).toContain(
      "finite element analysis"
    );
    expect(extractCandidateTerms(referenceText)).toContain(
      "convolutional neural network"
    );
  });

  it("builds an aggregate style profile from references", () => {
    const references = addReferencePaper([], {
      name: "style.txt",
      type: "txt",
      text: referenceText
    });
    const profile = buildStyleProfile(references);

    expect(profile.referenceCount).toBe(1);
    expect(profile.phrases).toContain("the proposed framework");
    expect(profile.terms).toContain("finite element analysis");
    expect(profile.brief).toContain("Use field-specific terminology");
  });
});
