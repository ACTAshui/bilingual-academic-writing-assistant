import { ChangeEvent, useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  FileUp,
  Languages,
  Sparkles,
  Wand2
} from "lucide-react";
import type {
  AiAction,
  AiProvider,
  Paragraph,
  ReferencePaper
} from "./types";
import {
  createParagraphs,
  getParagraph,
  updateParagraphDraft,
  updateParagraphSource
} from "./lib/documentModel";
import { parseUploadedFile } from "./lib/fileParsers";
import { addReferencePaper, buildStyleProfile } from "./lib/styleProfile";
import { getProviderOptions, runAiAction } from "./lib/aiAdapters";
import {
  createDownload,
  exportBilingualText,
  exportDocxBlob,
  exportEnglishText
} from "./lib/exporters";

const providerOptions = getProviderOptions();

export default function App() {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferencePaper[]>([]);
  const [provider, setProvider] = useState<AiProvider>("mock");
  const [model, setModel] = useState("local-mock");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("Ready");

  const styleProfile = useMemo(() => buildStyleProfile(references), [references]);
  const selectedParagraph =
    selectedId === null ? undefined : getParagraph(paragraphs, selectedId);

  async function handleManuscriptUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseUploadedFile(file);
      const nextParagraphs = createParagraphs(parsed.text);
      setParagraphs(nextParagraphs);
      setSelectedId(nextParagraphs[0]?.id ?? null);
      setStatus(`Imported ${parsed.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      input.value = "";
    }
  }

  async function handleReferenceUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    if (files.length === 0) return;

    try {
      let nextReferences = references;
      for (const file of files) {
        const parsed = await parseUploadedFile(file);
        nextReferences = addReferencePaper(nextReferences, parsed);
      }
      setReferences(nextReferences);
      setStatus(`Reference library updated: ${nextReferences.length} / 10`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reference import failed");
    } finally {
      input.value = "";
    }
  }

  function handleSourceChange(id: string, value: string) {
    setParagraphs((current) => updateParagraphSource(current, id, value));
  }

  function handleDraftChange(id: string, value: string) {
    setParagraphs((current) => updateParagraphDraft(current, id, value));
  }

  async function handleAiAction(action: AiAction) {
    if (!selectedParagraph) {
      setStatus("Select a paragraph first");
      return;
    }

    try {
      const result = await runAiAction(
        {
          provider,
          model,
          endpoint: endpoint.trim() || undefined,
          apiKey: apiKey.trim() || undefined
        },
        {
          action,
          sourceZh: selectedParagraph.sourceZh,
          draftEn: selectedParagraph.draftEn,
          styleProfile
        }
      );

      if (action === "explain") {
        setStatus(result.text);
      } else {
        setParagraphs((current) =>
          updateParagraphDraft(current, selectedParagraph.id, result.text)
        );
        setStatus(result.notes);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI action failed");
    }
  }

  async function handleBatchTranslate() {
    const emptyParagraphs = paragraphs.filter(
      (paragraph) => !paragraph.draftEn.trim()
    );

    let nextParagraphs = paragraphs;
    for (const paragraph of emptyParagraphs) {
      const result = await runAiAction(
        { provider: "mock", model: "local-mock" },
        {
          action: "translate",
          sourceZh: paragraph.sourceZh,
          styleProfile
        }
      );
      nextParagraphs = updateParagraphDraft(nextParagraphs, paragraph.id, result.text);
    }
    setParagraphs(nextParagraphs);
    setStatus(`Batch translated ${emptyParagraphs.length} paragraph(s)`);
  }

  async function handleDownload(kind: "english" | "bilingual" | "docx") {
    const artifact =
      kind === "english"
        ? createDownload(
            "english-draft.txt",
            "text/plain;charset=utf-8",
            exportEnglishText(paragraphs)
          )
        : kind === "bilingual"
          ? createDownload(
              "bilingual-draft.txt",
              "text/plain;charset=utf-8",
              exportBilingualText(paragraphs)
            )
          : createDownload(
              "english-draft.docx",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              await exportDocxBlob(paragraphs, "english")
            );

    if (typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(artifact.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
    setStatus(`Prepared ${artifact.fileName}`);
  }

  return (
    <main className="app-shell">
      <aside className="project-rail" aria-label="Project rail">
        <div className="brand-block">
          <Languages aria-hidden="true" size={26} />
          <div>
            <p className="eyebrow">Local manuscript workbench</p>
            <h1>Bilingual Academic Writer</h1>
          </div>
        </div>

        <section className="rail-section">
          <h2>Manuscript</h2>
          <label className="file-control">
            <FileUp aria-hidden="true" size={18} />
            <span>Import manuscript</span>
            <input
              aria-label="Import manuscript"
              type="file"
              accept=".docx,.txt,.tex"
              onChange={handleManuscriptUpload}
            />
          </label>
          <p className="metric">{paragraphs.length} paragraphs</p>
        </section>

        <section className="rail-section">
          <h2>Reference Library</h2>
          <label className="file-control">
            <BookOpen aria-hidden="true" size={18} />
            <span>Add reference papers</span>
            <input
              aria-label="Add reference papers"
              type="file"
              accept=".pdf,.docx,.txt,.tex"
              multiple
              onChange={handleReferenceUpload}
            />
          </label>
          <p className="metric">{references.length} / 10 references</p>
          <div className="style-brief">
            <strong>Style profile</strong>
            <p>
              {references.length
                ? `Style cues ready from ${references.length} reference paper(s).`
                : styleProfile.brief}
            </p>
            {styleProfile.terms.length > 0 && (
              <ul>
                {styleProfile.terms.slice(0, 5).map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rail-section">
          <h2>Export</h2>
          <button type="button" onClick={() => void handleDownload("english")}>
            <Download aria-hidden="true" size={17} />
            Download English TXT
          </button>
          <button type="button" onClick={() => void handleDownload("bilingual")}>
            <Download aria-hidden="true" size={17} />
            Download Bilingual TXT
          </button>
          <button type="button" onClick={() => void handleDownload("docx")}>
            <Download aria-hidden="true" size={17} />
            Download English DOCX
          </button>
        </section>
      </aside>

      <section className="editor-workspace" aria-label="Split editor">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Selected paragraph</p>
            <h2>{selectedParagraph?.id ?? "No manuscript loaded"}</h2>
          </div>
          <p className="status-line">{status}</p>
        </header>

        <div className="pane-labels">
          <h2>Chinese Source</h2>
          <h2>English Draft</h2>
        </div>

        <div className="paragraph-list">
          {paragraphs.length === 0 ? (
            <div className="empty-state">
              <p>Import a manuscript to begin paragraph-level writing.</p>
            </div>
          ) : (
            paragraphs.map((paragraph, index) => (
              <article
                className={
                  paragraph.id === selectedId
                    ? "paragraph-row selected"
                    : "paragraph-row"
                }
                data-testid={`paragraph-${paragraph.id}`}
                key={paragraph.id}
                onClick={() => setSelectedId(paragraph.id)}
              >
                <div className="row-meta">
                  <span>{index + 1}</span>
                  <span>{paragraph.status}</span>
                </div>
                <label>
                  <span>Chinese paragraph {index + 1}</span>
                  <textarea
                    aria-label={`Chinese paragraph ${index + 1}`}
                    value={paragraph.sourceZh}
                    onChange={(event) =>
                      handleSourceChange(paragraph.id, event.currentTarget.value)
                    }
                  />
                </label>
                <label>
                  <span>English paragraph {index + 1}</span>
                  <textarea
                    aria-label={`English paragraph ${index + 1}`}
                    value={paragraph.draftEn}
                    onChange={(event) =>
                      handleDraftChange(paragraph.id, event.currentTarget.value)
                    }
                  />
                </label>
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="ai-panel" aria-label="AI panel">
        <div className="panel-heading">
          <Sparkles aria-hidden="true" size={22} />
          <div>
            <p className="eyebrow">Provider</p>
            <h2>AI Actions</h2>
          </div>
        </div>

        <label className="field">
          <span>Provider</span>
          <select
            aria-label="Provider"
            value={provider}
            onChange={(event) => setProvider(event.currentTarget.value as AiProvider)}
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Model</span>
          <input
            value={model}
            onChange={(event) => setModel(event.currentTarget.value)}
          />
        </label>

        <label className="field">
          <span>Endpoint</span>
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.currentTarget.value)}
            placeholder="https://api.example.com/v1/chat"
          />
        </label>

        <label className="field">
          <span>API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
          />
        </label>

        <div className="action-group">
          <button type="button" onClick={() => void handleAiAction("translate")}>
            <Wand2 aria-hidden="true" size={17} />
            Translate selected
          </button>
          <button type="button" onClick={() => void handleAiAction("polish")}>
            <Wand2 aria-hidden="true" size={17} />
            Polish selected
          </button>
          <button
            type="button"
            onClick={() => void handleAiAction("style-rewrite")}
          >
            <Wand2 aria-hidden="true" size={17} />
            Match reference style
          </button>
          <button type="button" onClick={() => void handleAiAction("explain")}>
            <Wand2 aria-hidden="true" size={17} />
            Explain revision
          </button>
          <button type="button" onClick={() => void handleBatchTranslate()}>
            <Wand2 aria-hidden="true" size={17} />
            Batch translate empty
          </button>
        </div>
      </aside>
    </main>
  );
}
