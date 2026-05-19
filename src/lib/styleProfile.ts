import type { ParsedFile, ReferencePaper, StyleProfile } from "../types";

const phrasePatterns = [
  /\bthe proposed (?:framework|method|approach|model)\b/gi,
  /\bexperimental results demonstrate\b/gi,
  /\bthe results indicate\b/gi,
  /\bsignificantly improves\b/gi,
  /\bis robust\b/gi
];

const termPatterns = [
  /\bfinite element analysis\b/gi,
  /\bconvolutional neural network\b/gi,
  /\bclassification accuracy\b/gi,
  /\bproposed method\b/gi,
  /\bproposed framework\b/gi
];

export function addReferencePaper(
  references: ReferencePaper[],
  parsedFile: ParsedFile
): ReferencePaper[] {
  if (references.length >= 10) {
    throw new Error("Reference library supports up to 10 papers");
  }

  return [
    ...references,
    {
      id: `ref-${references.length + 1}`,
      name: parsedFile.name,
      type: parsedFile.type,
      text: parsedFile.text,
      wordCount: countWords(parsedFile.text),
      status: "ready"
    }
  ];
}

export function buildStyleProfile(references: ReferencePaper[]): StyleProfile {
  const corpus = references.map((reference) => reference.text).join("\n\n");
  const phrases = extractAcademicPhrases(corpus);
  const terms = extractCandidateTerms(corpus);

  return {
    referenceCount: references.length,
    phrases,
    terms,
    brief:
      references.length === 0
        ? "No reference papers loaded. Use a clear academic tone with precise wording."
        : [
            `Use field-specific terminology from ${references.length} reference paper(s).`,
            terms.length ? `Prefer terms such as ${terms.slice(0, 5).join(", ")}.` : "",
            phrases.length
              ? `Mirror concise patterns such as ${phrases.slice(0, 4).join(", ")}.`
              : ""
          ]
            .filter(Boolean)
            .join(" ")
  };
}

export function extractAcademicPhrases(text: string): string[] {
  return uniqueMatches(text, phrasePatterns);
}

export function extractCandidateTerms(text: string): string[] {
  return uniqueMatches(text, termPatterns);
}

function uniqueMatches(text: string, patterns: RegExp[]): string[] {
  const values = patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => match[0].toLowerCase())
  );

  return [...new Set(values)].slice(0, 16);
}

function countWords(text: string): number {
  return text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
