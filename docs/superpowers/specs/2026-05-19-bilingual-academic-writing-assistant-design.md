# Bilingual Academic Writing Assistant Design

## Product Goal

Build a local-first web app for Chinese-to-English academic writing. The app imports a manuscript, shows Chinese and English panes side by side, helps translate and polish paragraph-level academic prose through selectable API providers, learns style cues from up to 10 reference papers, and exports the edited result.

## Target User

The primary user is a researcher writing an English manuscript from Chinese notes or a Chinese draft. They need field-specific wording, consistent terminology, and fast paragraph-by-paragraph revision rather than a generic translation page.

## Approved Product Direction

Use an integrated writing workbench:

- Left rail: project status, manuscript import, reference paper library, style profile, export actions.
- Center workspace: synchronized Chinese and English paragraph editors.
- Right inspector: API provider/model settings, action mode, output controls, revision notes.

This combines the requested "paper writing assistant" and "bilingual editor" rather than building a read-only translation viewer.

## Core Workflows

### Manuscript Import

The user imports a main manuscript as `docx`, `txt`, or `tex`.

- `txt`: read plain text directly.
- `tex`: strip common LaTeX commands enough to recover readable paragraph text while preserving section-like labels.
- `docx`: extract paragraph text from the Word document.

The imported text is split into stable paragraph records. Each record has an id, Chinese source text, English draft text, status, notes, and version history.

### Split Editing

The center workspace displays linked paragraph rows:

- Chinese source pane on the left.
- English draft pane on the right.
- Selecting a row selects the matching paragraph in both panes.
- Both panes are editable.
- Editing marks the paragraph as changed.
- AI output can replace the English draft for the selected paragraph or fill empty English drafts in batch mode.

### Academic AI Assistance

The user can choose a provider and model before running an action. First version includes:

- Mock local provider for offline testing and demos.
- OpenAI-compatible provider configuration fields.
- Custom endpoint provider fields for other APIs.
- Google Translate-style option as a conceptual provider slot, implemented through the same adapter interface when credentials or endpoints are available.

Supported actions:

- Translate selected paragraph.
- Polish selected English draft.
- Rewrite selected paragraph using the reference-paper style profile.
- Batch translate empty English paragraphs.
- Explain revision choices.

Real provider calls must be isolated behind one adapter interface so the app can work without keys and can later add more APIs without rewriting UI logic.

### Reference Paper Style Library

The user can add up to 10 reference papers. Accepted reference formats are `pdf`, `docx`, `txt`, and `tex`.

First-version priority:

- Text formats (`txt`, `docx`, `tex`) should be reliable.
- PDF support should perform basic text extraction only; exact layout recovery is not required.

For each reference paper, the app stores filename, detected type, extracted text preview, word count, and status. The style profile aggregates:

- Frequent academic phrases.
- Candidate terminology.
- Sentence-pattern hints.
- A concise style brief used in AI prompts.

The style profile is generated locally from extracted text for the mock flow and included in API prompts for real providers.

### Export

The app exports:

- English-only draft as `.txt`.
- Bilingual aligned draft as `.txt`.
- Basic `.docx` export if the runtime library is available.

Export content should come from the current editor state, not from the original imported file.

## Non-Goals For Version 1

- Multi-user collaboration.
- Cloud accounts or authentication.
- Perfect PDF layout reconstruction.
- Full citation-manager replacement.
- Journal-specific submission validation.
- Long-term hosted database.

## Architecture

Use a small web app with clear modules:

- `fileParsers`: turn uploaded manuscript/reference files into text.
- `documentModel`: split and maintain paragraph records.
- `styleProfile`: derive terminology and phrase hints from up to 10 references.
- `aiAdapters`: normalize mock, OpenAI-compatible, custom endpoint, and Google-style providers.
- `exporters`: serialize editor state into downloadable files.
- `Workbench UI`: renders the left rail, split editor, and right AI panel.

The app should be usable locally without a backend for the first version. Browser-side parsing and export are acceptable for MVP. API calls that require secrets must make the user paste a key into the local session rather than storing it permanently.

## Data Model

```ts
type Paragraph = {
  id: string;
  sourceZh: string;
  draftEn: string;
  status: "empty" | "drafted" | "edited" | "accepted";
  notes: string[];
  history: string[];
};

type ReferencePaper = {
  id: string;
  name: string;
  type: "pdf" | "docx" | "txt" | "tex";
  text: string;
  wordCount: number;
  status: "ready" | "error";
};

type StyleProfile = {
  referenceCount: number;
  phrases: string[];
  terms: string[];
  brief: string;
};

type AiProviderConfig = {
  provider: "mock" | "openai-compatible" | "custom-endpoint" | "google-style";
  model: string;
  endpoint?: string;
  apiKey?: string;
};
```

## Error Handling

- Unsupported files show a clear message and do not alter the current document.
- More than 10 reference papers are rejected with an explanatory message.
- Empty imports are rejected.
- API failures keep the existing paragraph unchanged and show the error in the AI panel.
- Export failures preserve editor state and report which format failed.

## Testing Strategy

Test the app at three levels:

- Unit tests for text splitting, TeX cleanup, style-profile extraction, reference limit enforcement, mock AI behavior, and exporters.
- Component tests for importing a manuscript, editing linked panes, adding references, running mock AI actions, and exporting.
- Browser verification for the final workbench layout and core interaction path.

## Success Criteria

- The app imports `docx`, `txt`, and `tex` manuscripts into paragraph records.
- The user can edit Chinese and English panes side by side.
- The user can select an AI provider and run translate/polish/style actions.
- The reference library accepts no more than 10 papers and updates a style profile.
- The app exports English-only and bilingual outputs from current editor state.
- The app runs locally and passes automated tests plus a manual browser smoke check.
