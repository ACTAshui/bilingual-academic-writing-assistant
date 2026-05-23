import {
  ChangeEvent,
  ClipboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BookOpen,
  Download,
  Eraser,
  FileUp,
  Languages,
  ListChecks,
  Sparkles,
  Trash2,
  Wand2
} from "lucide-react";
import type {
  AiAction,
  AiResult,
  AiProvider,
  EditSide,
  Paragraph,
  ParagraphNote,
  QuickTranslationProvider,
  ReferencePaper,
  TextLanguage
} from "./types";
import {
  clearParagraph,
  createParagraphs,
  getParagraph,
  replaceParagraphWithSegments,
  splitTextIntoSegments,
  updateParagraphNotes,
  updateParagraphDraft,
  updateParagraphSource
} from "./lib/documentModel";
import { parseUploadedFile } from "./lib/fileParsers";
import { addReferencePaper, buildStyleProfile } from "./lib/styleProfile";
import {
  getProviderOptions,
  getProviderPreset,
  getQuickTranslationOptions,
  runQuickTranslation,
  runAiAction
} from "./lib/aiAdapters";
import {
  createDownload,
  exportBilingualText,
  exportChineseText,
  exportDocxBlob,
  exportEnglishText,
  selectParagraphRange
} from "./lib/exporters";

type AutoTranslateMode = "off" | "api" | "quick";
type DownloadKind =
  | "chinese-text"
  | "english-text"
  | "bilingual-text"
  | "chinese-docx"
  | "english-docx";
type TranslationJob = {
  id: string;
  sourceSide: EditSide;
  sourceText: string;
  targetLanguage: "zh" | "en";
};
type GeneratedText = {
  text: string;
  notes: string[];
};
type SplitCandidate = {
  side: EditSide;
  segments: string[];
};

const AUTO_TRANSLATE_DELAY_MS = 4000;
const BATCH_TRANSLATION_CONCURRENCY = 3;

const providerOptions = getProviderOptions();
const quickTranslationOptions = getQuickTranslationOptions();
const statusLabels: Record<Paragraph["status"], string> = {
  empty: "待生成",
  drafted: "草稿",
  edited: "已编辑",
  accepted: "已确认"
};
const languageLabels: Record<TextLanguage, string> = {
  zh: "中文",
  en: "英文",
  mixed: "混合",
  empty: "待识别"
};

export default function App() {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [references, setReferences] = useState<ReferencePaper[]>([]);
  const [provider, setProvider] = useState<AiProvider>("deepseek");
  const [model, setModel] = useState("deepseek-v4-pro");
  const [endpoint, setEndpoint] = useState("https://api.deepseek.com");
  const [apiKey, setApiKey] = useState("");
  const [autoTranslateMode, setAutoTranslateMode] =
    useState<AutoTranslateMode>("api");
  const [quickTranslator, setQuickTranslator] =
    useState<QuickTranslationProvider>("google-public");
  const [isProjectRailOpen, setIsProjectRailOpen] = useState(true);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(true);
  const [isToolBarOpen, setIsToolBarOpen] = useState(true);
  const [exportStart, setExportStart] = useState("1");
  const [exportEnd, setExportEnd] = useState("0");
  const [status, setStatus] = useState("就绪");
  const autoTranslateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const styleProfile = useMemo(() => buildStyleProfile(references), [references]);
  const checkedIdSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const exportParagraphs = useMemo(
    () =>
      selectParagraphRange(paragraphs, Number(exportStart), Number(exportEnd)),
    [exportEnd, exportStart, paragraphs]
  );
  const selectedParagraph =
    selectedId === null ? undefined : getParagraph(paragraphs, selectedId);
  const selectedSplitCandidate = selectedParagraph
    ? getSplitCandidate(selectedParagraph)
    : undefined;

  useEffect(() => {
    clearAutoTranslateTimers();
  }, [autoTranslateMode]);

  useEffect(() => () => clearAutoTranslateTimers(), []);

  async function handleManuscriptUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseUploadedFile(file);
      const nextParagraphs = createParagraphs(parsed.text);
      setParagraphs(nextParagraphs);
      setSelectedId(nextParagraphs[0]?.id ?? null);
      setCheckedIds([]);
      setExportStart(nextParagraphs.length > 0 ? "1" : "0");
      setExportEnd(String(nextParagraphs.length));
      setStatus(`已导入 ${parsed.name}：${summarizeLanguages(nextParagraphs)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入失败");
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
      setStatus(`参考论文库已更新：${nextReferences.length} / 10`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "参考论文导入失败");
    } finally {
      input.value = "";
    }
  }

  function handleSourceChange(id: string, value: string) {
    setParagraphs((current) => updateParagraphSource(current, id, value));
    scheduleAutoTranslate(id, "zh", value);
  }

  function handleDraftChange(id: string, value: string) {
    setParagraphs((current) => updateParagraphDraft(current, id, value));
    scheduleAutoTranslate(id, "en", value);
  }

  function handleParagraphPaste(
    event: ClipboardEvent<HTMLTextAreaElement>,
    id: string,
    side: EditSide
  ) {
    const pastedText =
      event.clipboardData.getData("text/plain") ||
      event.clipboardData.getData("text");
    const segments = splitTextIntoSegments(pastedText);
    if (segments.length <= 1) return;

    event.preventDefault();
    splitParagraphIntoRows(id, side, segments);
  }

  function handleSplitSelectedParagraph() {
    if (!selectedParagraph || !selectedSplitCandidate) {
      setStatus("当前段落未识别到可拆分的多个句子。");
      return;
    }

    splitParagraphIntoRows(
      selectedParagraph.id,
      selectedSplitCandidate.side,
      selectedSplitCandidate.segments
    );
  }

  function splitParagraphIntoRows(
    id: string,
    side: EditSide,
    segments: string[]
  ) {
    const cleanSegments = segments.map((segment) => segment.trim()).filter(Boolean);
    if (cleanSegments.length <= 1) {
      setStatus("当前内容未识别到可拆分的多个句子。");
      return;
    }

    const targetIndex = paragraphs.findIndex((paragraph) => paragraph.id === id);
    if (targetIndex === -1) return;

    clearAutoTranslateTimers();
    const nextParagraphs = replaceParagraphWithSegments(
      paragraphs,
      id,
      side,
      cleanSegments
    );
    setParagraphs(nextParagraphs);
    setSelectedId(nextParagraphs[targetIndex]?.id ?? nextParagraphs[0]?.id ?? null);
    setCheckedIds([]);
    setExportStart(nextParagraphs.length > 0 ? "1" : "0");
    setExportEnd(String(nextParagraphs.length));
    setStatus(`已拆分为 ${cleanSegments.length} 个句子，可逐句分离写作。`);
  }

  function handleProviderChange(nextProvider: AiProvider) {
    const preset = getProviderPreset(nextProvider);
    setProvider(nextProvider);
    setModel(preset.defaultModel);
    setEndpoint(preset.defaultEndpoint);
  }

  function handleModelChange(value: string) {
    setModel(value);
  }

  function handleEndpointChange(value: string) {
    setEndpoint(value);
  }

  function scheduleAutoTranslate(id: string, side: EditSide, value: string) {
    const key = `${id}:${side}`;
    window.clearTimeout(autoTranslateTimers.current[key]);
    delete autoTranslateTimers.current[key];

    if (autoTranslateMode === "off") return;
    if (!value.trim()) {
      void triggerAutoTranslate(id, side, value, autoTranslateMode);
      return;
    }

    autoTranslateTimers.current[key] = window.setTimeout(() => {
      delete autoTranslateTimers.current[key];
      void triggerAutoTranslate(id, side, value, autoTranslateMode);
    }, AUTO_TRANSLATE_DELAY_MS);
  }

  function clearAutoTranslateTimers() {
    Object.values(autoTranslateTimers.current).forEach((timer) =>
      window.clearTimeout(timer)
    );
    autoTranslateTimers.current = {};
  }

  async function triggerAutoTranslate(
    id: string,
    side: EditSide,
    value: string,
    mode: AutoTranslateMode
  ) {
    if (mode === "off") return;

    const trimmed = value.trim();
    if (!trimmed) {
      setParagraphs((current) =>
        side === "zh"
          ? updateParagraphDraft(current, id, "")
          : updateParagraphSource(current, id, "")
      );
      setStatus("已同步清空另一侧。");
      return;
    }

    const targetLanguage = side === "zh" ? "en" : "zh";
    const snapshot = value;
    setStatus(
      `正在${mode === "api" ? "API" : "快速"}自动翻译为${targetLanguage === "en" ? "英文" : "中文"}...`
    );

    try {
      const result =
        mode === "quick"
          ? await runQuickTranslation({
              provider: quickTranslator,
              sourceText: trimmed,
              targetLanguage
            })
          : await runAiAction(
              {
                provider,
                model,
                endpoint: endpoint.trim() || undefined,
                apiKey: apiKey.trim() || undefined
              },
              {
                action: "translate",
                sourceText: trimmed,
                sourceZh: side === "zh" ? trimmed : undefined,
                draftEn: side === "en" ? trimmed : undefined,
                targetLanguage,
                styleProfile
              }
            );

      setParagraphs((current) => {
        const paragraph = getParagraph(current, id);
        if (!paragraph) return current;
        if (side === "zh" && paragraph.sourceZh !== snapshot) return current;
        if (side === "en" && paragraph.draftEn !== snapshot) return current;

        return applyGeneratedText(current, id, side === "zh" ? "en" : "zh", result);
      });
      setStatus(result.notes);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : `${mode === "quick" ? "快速" : "API"}自动翻译失败`
      );
    }
  }

  async function handleAiAction(action: AiAction, reviseSide?: EditSide) {
    if (!selectedParagraph) {
      setStatus("请先选择一个段落");
      return;
    }

    if (action === "translate" && checkedIds.length > 1) {
      await handleTranslateCheckedTogether();
      return;
    }

    const sourceText =
      action === "polish" && reviseSide === "zh"
        ? selectedParagraph.sourceZh.trim()
        : action === "polish" && reviseSide === "en"
          ? selectedParagraph.draftEn.trim()
          : selectedParagraph.sourceZh.trim() || selectedParagraph.draftEn.trim();
    if (!sourceText) {
      setStatus(
        reviseSide === "zh"
          ? "中文侧没有可润色内容"
          : reviseSide === "en"
            ? "英文侧没有可润色内容"
            : "当前段落没有可翻译或润色的内容"
      );
      return;
    }

    const targetLanguage =
      action === "translate"
        ? selectedParagraph.sourceZh.trim()
          ? "en"
          : "zh"
        : reviseSide === "zh"
          ? "zh"
          : "en";

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
          sourceText,
          sourceZh:
            action === "polish" && reviseSide === "zh"
              ? sourceText
              : selectedParagraph.sourceZh,
          draftEn:
            action === "polish" && reviseSide === "en"
              ? sourceText
              : selectedParagraph.draftEn,
          targetLanguage,
          styleProfile
        }
      );

      if (action === "explain") {
        setStatus(result.text);
      } else if (targetLanguage === "zh") {
        setParagraphs((current) =>
          applyGeneratedText(current, selectedParagraph.id, "zh", result)
        );
        setStatus(result.notes);
      } else {
        setParagraphs((current) =>
          applyGeneratedText(current, selectedParagraph.id, "en", result)
        );
        setStatus(result.notes);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 操作失败");
    }
  }

  async function handleTranslateFrom(sourceSide: EditSide) {
    if (!selectedParagraph) {
      setStatus("请先选择一个段落");
      return;
    }

    const sourceText =
      sourceSide === "zh"
        ? selectedParagraph.sourceZh.trim()
        : selectedParagraph.draftEn.trim();
    if (!sourceText) {
      setStatus(sourceSide === "zh" ? "中文侧没有内容" : "英文侧没有内容");
      return;
    }

    const targetLanguage = sourceSide === "zh" ? "en" : "zh";
    setStatus(`正在翻译为${targetLanguage === "en" ? "英文" : "中文"}...`);

    try {
      const result = await runAiAction(
        {
          provider,
          model,
          endpoint: endpoint.trim() || undefined,
          apiKey: apiKey.trim() || undefined
        },
        {
          action: "translate",
          sourceText,
          sourceZh: sourceSide === "zh" ? sourceText : undefined,
          draftEn: sourceSide === "en" ? sourceText : undefined,
          targetLanguage,
          styleProfile
        }
      );

      setParagraphs((current) =>
        applyGeneratedText(current, selectedParagraph.id, targetLanguage, result)
      );
      setStatus(result.notes);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "定向翻译失败");
    }
  }

  async function handleQuickTranslateSelected() {
    if (!selectedParagraph) {
      setStatus("请先选择一个段落");
      return;
    }

    const sourceSide = selectedParagraph.sourceZh.trim() ? "zh" : "en";
    const sourceText =
      sourceSide === "zh"
        ? selectedParagraph.sourceZh.trim()
        : selectedParagraph.draftEn.trim();

    if (!sourceText) {
      setStatus("当前段落没有可快速翻译的内容");
      return;
    }

    const targetLanguage = sourceSide === "zh" ? "en" : "zh";
    setStatus(
      `正在快速翻译为${targetLanguage === "en" ? "英文" : "中文"}...`
    );

    try {
      const result = await runQuickTranslation({
        provider: quickTranslator,
        sourceText,
        targetLanguage
      });

      setParagraphs((current) =>
        applyGeneratedText(current, selectedParagraph.id, targetLanguage, result)
      );
      setStatus(result.notes);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "快速翻译失败");
    }
  }

  async function handleBatchTranslate() {
    const jobs = paragraphs.flatMap((paragraph): TranslationJob[] => {
      if (paragraph.sourceZh.trim() && !paragraph.draftEn.trim()) {
        return [
          {
            id: paragraph.id,
            sourceSide: "zh",
            sourceText: paragraph.sourceZh.trim(),
            targetLanguage: "en"
          }
        ];
      }
      if (paragraph.draftEn.trim() && !paragraph.sourceZh.trim()) {
        return [
          {
            id: paragraph.id,
            sourceSide: "en",
            sourceText: paragraph.draftEn.trim(),
            targetLanguage: "zh"
          }
        ];
      }
      return [];
    });

    if (jobs.length === 0) {
      setStatus("没有需要补全的空白侧。");
      return;
    }

    try {
      setStatus(
        `正在并行补全 ${jobs.length} 个空白侧，最多同时 ${BATCH_TRANSLATION_CONCURRENCY} 段...`
      );
      const result = await runTranslationJobs(jobs, paragraphs);
      setParagraphs(result.nextParagraphs);
      setStatus(`已批量补全 ${result.translatedCount} 个空白侧。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "批量补全失败");
    }
  }

  async function handleTranslateCheckedFrom(sourceSide: EditSide) {
    const checkedSet = new Set(checkedIds);
    const candidates = paragraphs.filter((paragraph) => checkedSet.has(paragraph.id));
    if (candidates.length === 0) {
      setStatus("请先勾选要批量翻译的段落。");
      return;
    }

    const targetLanguage = sourceSide === "zh" ? "en" : "zh";
    const jobs: TranslationJob[] = [];
    let skippedCount = 0;
    for (const paragraph of candidates) {
      const sourceText =
        sourceSide === "zh"
          ? paragraph.sourceZh.trim()
          : paragraph.draftEn.trim();
      if (!sourceText) {
        skippedCount += 1;
        continue;
      }
      jobs.push({
        id: paragraph.id,
        sourceSide,
        sourceText,
        targetLanguage
      });
    }

    if (jobs.length === 0) {
      setStatus("选中段落在该语言侧都是空白，无法批量翻译。");
      return;
    }

    setStatus(
      `正在并行将 ${jobs.length} 个选中段落翻译为${targetLanguage === "en" ? "英文" : "中文"}...`
    );

    try {
      const result = await runTranslationJobs(jobs, paragraphs);
      setParagraphs(result.nextParagraphs);
      setStatus(
        skippedCount
          ? `已翻译选中段落 ${result.translatedCount} 个，跳过 ${skippedCount} 个空白段落。`
          : `已翻译选中段落 ${result.translatedCount} 个。`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "选中段落批量翻译失败");
    }
  }

  async function runTranslationJobs(
    jobs: TranslationJob[],
    baseParagraphs: Paragraph[]
  ) {
    const completed: Array<(TranslationJob & GeneratedText) | undefined> = [];
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < jobs.length) {
        const index = nextIndex;
        nextIndex += 1;
        const job = jobs[index];
        const result = await runAiAction(
          {
            provider,
            model,
            endpoint: endpoint.trim() || undefined,
            apiKey: apiKey.trim() || undefined
          },
          {
            action: "translate",
            sourceText: job.sourceText,
            sourceZh: job.sourceSide === "zh" ? job.sourceText : undefined,
            draftEn: job.sourceSide === "en" ? job.sourceText : undefined,
            targetLanguage: job.targetLanguage,
            styleProfile
          }
        );
        completed[index] = { ...job, ...splitGeneratedText(result) };
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(BATCH_TRANSLATION_CONCURRENCY, jobs.length) },
        () => worker()
      )
    );

    let nextParagraphs = baseParagraphs;
    let translatedCount = 0;
    for (const item of completed) {
      if (!item) continue;
      if (item.text) {
        nextParagraphs =
          item.targetLanguage === "en"
            ? updateParagraphDraft(nextParagraphs, item.id, item.text)
            : updateParagraphSource(nextParagraphs, item.id, item.text);
        translatedCount += 1;
      }
      if (item.notes.length > 0) {
        nextParagraphs = updateParagraphNotes(
          nextParagraphs,
          item.id,
          toParagraphNotes(item.notes, item.targetLanguage)
        );
      }
    }

    return { nextParagraphs, translatedCount };
  }

  async function handleTranslateCheckedTogether() {
    const checkedSet = new Set(checkedIds);
    const selectedParagraphs = paragraphs.filter((paragraph) =>
      checkedSet.has(paragraph.id)
    );
    const firstWithText = selectedParagraphs.find(
      (paragraph) => paragraph.sourceZh.trim() || paragraph.draftEn.trim()
    );
    if (!firstWithText) {
      setStatus("选中段落没有可翻译内容。");
      return;
    }

    const sourceSide = firstWithText.sourceZh.trim() ? "zh" : "en";
    const targetLanguage = sourceSide === "zh" ? "en" : "zh";
    const jobs = selectedParagraphs
      .map((paragraph): TranslationJob | null => {
        const sourceText =
          sourceSide === "zh"
            ? paragraph.sourceZh.trim()
            : paragraph.draftEn.trim();
        return sourceText
          ? {
              id: paragraph.id,
              sourceSide,
              sourceText,
              targetLanguage
            }
          : null;
      })
      .filter((job): job is TranslationJob => job !== null);

    if (jobs.length === 0) {
      setStatus("选中段落在同一语言侧都是空白，无法合并翻译。");
      return;
    }

    setStatus(
      `正在把 ${jobs.length} 个选中段落合并为 1 次请求，并按从上到下回填...`
    );

    try {
      const result = await runAiAction(
        {
          provider,
          model,
          endpoint: endpoint.trim() || undefined,
          apiKey: apiKey.trim() || undefined
        },
        {
          action: "translate",
          sourceText: buildCombinedTranslationSource(jobs, targetLanguage),
          targetLanguage,
          styleProfile
        }
      );
      const generated = splitGeneratedText(result);
      const translatedTexts = splitCombinedGeneratedText(generated.text, jobs.length);

      setParagraphs((current) => {
        let nextParagraphs = current;
        jobs.forEach((job, index) => {
          const translatedText = translatedTexts[index]?.trim();
          if (!translatedText) return;
          nextParagraphs =
            targetLanguage === "en"
              ? updateParagraphDraft(nextParagraphs, job.id, translatedText)
              : updateParagraphSource(nextParagraphs, job.id, translatedText);

          if (generated.notes.length > 0) {
            nextParagraphs = updateParagraphNotes(
              nextParagraphs,
              job.id,
              toParagraphNotes(generated.notes, targetLanguage)
            );
          }
        });
        return nextParagraphs;
      });
      setStatus(`已用 1 次 API 请求翻译 ${translatedTexts.length} 个选中段落。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "选中段落合并翻译失败");
    }
  }

  function handleToggleChecked(id: string, checked: boolean) {
    setCheckedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((checkedId) => checkedId !== id);
    });
  }

  function handleSelectAll() {
    setCheckedIds(paragraphs.map((paragraph) => paragraph.id));
    setStatus(`已选择 ${paragraphs.length} 个段落。`);
  }

  function handleClearChecked() {
    setCheckedIds([]);
    setStatus("已取消批量选择。");
  }

  function handleClearSelected() {
    if (!selectedId) return;
    setParagraphs((current) =>
      current.map((paragraph) =>
        paragraph.id === selectedId ? clearParagraph(paragraph) : paragraph
      )
    );
    setStatus("已清空当前段落。");
  }

  function handleClearAll() {
    setParagraphs([]);
    setSelectedId(null);
    setCheckedIds([]);
    setExportStart("1");
    setExportEnd("0");
    setStatus("已清空主稿。");
  }

  async function handleDownload(kind: DownloadKind) {
    if (exportParagraphs.length === 0) {
      setStatus("没有可导出的段落，请先导入主稿或调整范围。");
      return;
    }

    const textMimeType = "text/plain;charset=utf-8";
    const docxMimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const artifact =
      kind === "chinese-text"
        ? createDownload(
            "chinese-draft.txt",
            textMimeType,
            exportChineseText(exportParagraphs)
          )
        : kind === "english-text"
          ? createDownload(
              "english-draft.txt",
              textMimeType,
              exportEnglishText(exportParagraphs)
            )
          : kind === "bilingual-text"
            ? createDownload(
                "bilingual-draft.txt",
                textMimeType,
                exportBilingualText(exportParagraphs)
              )
            : kind === "chinese-docx"
              ? createDownload(
                  "chinese-draft.docx",
                  docxMimeType,
                  await exportDocxBlob(exportParagraphs, "chinese")
                )
              : createDownload(
                  "english-draft.docx",
                  docxMimeType,
                  await exportDocxBlob(exportParagraphs, "english")
                );

    if (typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(artifact.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
    setStatus(`已准备下载：${artifact.fileName}`);
  }

  function applyGeneratedText(
    current: Paragraph[],
    id: string,
    targetLanguage: "zh" | "en",
    result: AiResult
  ) {
    const generated = splitGeneratedText(result);
    let nextParagraphs = current;

    if (generated.text) {
      nextParagraphs =
        targetLanguage === "en"
          ? updateParagraphDraft(current, id, generated.text)
          : updateParagraphSource(current, id, generated.text);
    }

    if (generated.notes.length > 0) {
      nextParagraphs = updateParagraphNotes(
        nextParagraphs,
        id,
        toParagraphNotes(generated.notes, targetLanguage)
      );
    }

    return nextParagraphs;
  }

  return (
    <main className={`app-shell${isProjectRailOpen ? "" : " rail-collapsed"}`}>
      {isProjectRailOpen && (
      <aside className="project-rail" aria-label="项目侧栏">
        <div className="brand-block">
          <Languages aria-hidden="true" size={26} />
          <div>
            <p className="eyebrow">本地论文写作工作台</p>
            <h1>双语学术写作助手</h1>
          </div>
        </div>

        <section className="rail-section">
          <h2>主稿导入</h2>
          <label className="file-control">
            <FileUp aria-hidden="true" size={18} />
            <span>导入主稿</span>
            <input
              aria-label="导入主稿"
              type="file"
              accept=".docx,.txt,.tex"
              onChange={handleManuscriptUpload}
            />
          </label>
          <p className="example-text">
            示例：上传 <strong>中文或英文</strong> 的 <strong>docx</strong>、<strong>txt</strong> 或 <strong>tex</strong>。
          </p>
          <p className="metric">{paragraphs.length} 个段落</p>
        </section>

        <section className="rail-section">
          <h2>参考论文库</h2>
          <label className="file-control">
            <BookOpen aria-hidden="true" size={18} />
            <span>添加参考论文</span>
            <input
              aria-label="添加参考论文"
              type="file"
              accept=".pdf,.docx,.txt,.tex"
              multiple
              onChange={handleReferenceUpload}
            />
          </label>
          <p className="example-text">
            示例：放入同领域 3-10 篇论文，系统会提取常用术语和句式习惯。
          </p>
          <p className="metric">{references.length} / 10 篇参考论文</p>
          <div className="style-brief">
            <strong>风格画像</strong>
            <p>
              {references.length
                ? `已从 ${references.length} 篇参考论文提取风格线索。`
                : "尚未添加参考论文。可先使用清晰、准确、克制的通用学术表达。"}
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
          <h2>导出结果</h2>
          <p className="metric">总段数：{paragraphs.length}</p>
          <div className="export-range">
            <label className="field">
              <span>起始段</span>
              <input
                aria-label="导出起始段"
                min="1"
                max={Math.max(1, paragraphs.length)}
                type="number"
                value={exportStart}
                onChange={(event) => setExportStart(event.currentTarget.value)}
              />
            </label>
            <label className="field">
              <span>结束段</span>
              <input
                aria-label="导出结束段"
                min="1"
                max={Math.max(1, paragraphs.length)}
                type="number"
                value={exportEnd}
                onChange={(event) => setExportEnd(event.currentTarget.value)}
              />
            </label>
          </div>
          <p className="example-text">
            示例：总段数为 80 时，输入 10 到 25 只导出第 10-25 段。
          </p>
          <button
            type="button"
            onClick={() => void handleDownload("chinese-text")}
            disabled={exportParagraphs.length === 0}
          >
            <Download aria-hidden="true" size={17} />
            下载中文 TXT
          </button>
          <p className="example-text">示例：只导出左侧中文稿，适合保留原文或单独修改中文。</p>
          <button
            type="button"
            onClick={() => void handleDownload("english-text")}
            disabled={exportParagraphs.length === 0}
          >
            <Download aria-hidden="true" size={17} />
            下载英文 TXT
          </button>
          <p className="example-text">示例：只导出右侧英文稿，适合继续投稿前修改。</p>
          <button
            type="button"
            onClick={() => void handleDownload("bilingual-text")}
            disabled={exportParagraphs.length === 0}
          >
            <Download aria-hidden="true" size={17} />
            下载双语对照 TXT
          </button>
          <p className="example-text">示例：保留“中文原文 + 英文稿”，适合给导师或合作者核对。</p>
          <button
            type="button"
            onClick={() => void handleDownload("chinese-docx")}
            disabled={exportParagraphs.length === 0}
          >
            <Download aria-hidden="true" size={17} />
            下载中文 DOCX
          </button>
          <p className="example-text">示例：生成可在 Word 中继续排版的中文草稿。</p>
          <button
            type="button"
            onClick={() => void handleDownload("english-docx")}
            disabled={exportParagraphs.length === 0}
          >
            <Download aria-hidden="true" size={17} />
            下载英文 DOCX
          </button>
          <p className="example-text">示例：生成可在 Word 中继续排版的英文草稿。</p>
        </section>
      </aside>
      )}

      <section className="editor-workspace" aria-label="双语分屏编辑器">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">当前段落</p>
            <h2>{selectedParagraph?.id ?? "尚未导入主稿"}</h2>
          </div>
          <div className="workspace-actions">
            <label className="mode-control">
              <span>自动翻译方式</span>
              <select
                aria-label="自动翻译方式"
                value={autoTranslateMode}
                onChange={(event) =>
                  setAutoTranslateMode(event.currentTarget.value as AutoTranslateMode)
                }
              >
                <option value="api">API 自动翻译</option>
                <option value="quick">快速自动翻译</option>
                <option value="off">关闭自动翻译</option>
              </select>
            </label>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsProjectRailOpen((current) => !current)}
            >
              <Languages aria-hidden="true" size={16} />
              {isProjectRailOpen ? "隐藏左栏" : "显示左栏"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsToolBarOpen((current) => !current)}
            >
              <ListChecks aria-hidden="true" size={16} />
              {isToolBarOpen ? "隐藏工具" : "显示工具"}
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsApiSettingsOpen((current) => !current)}
            >
              <Sparkles aria-hidden="true" size={16} />
              {isApiSettingsOpen ? "隐藏 API 设置" : "显示 API 设置"}
            </button>
            <span className="selection-count">已选 {checkedIds.length} 段</span>
            {isToolBarOpen && (
              <>
            <button
              className="ghost-button"
              type="button"
              onClick={handleSelectAll}
              disabled={paragraphs.length === 0}
            >
              <ListChecks aria-hidden="true" size={16} />
              全选
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleClearChecked}
              disabled={checkedIds.length === 0}
            >
              <Eraser aria-hidden="true" size={16} />
              取消选择
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleAiAction("translate")}
            >
              <Wand2 aria-hidden="true" size={16} />
              补全当前段落
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleTranslateFrom("zh")}
              disabled={!selectedParagraph?.sourceZh.trim()}
            >
              <Wand2 aria-hidden="true" size={16} />
              中文译英文
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleTranslateFrom("en")}
              disabled={!selectedParagraph?.draftEn.trim()}
            >
              <Wand2 aria-hidden="true" size={16} />
              英文译中文
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleQuickTranslateSelected()}
              disabled={
                !selectedParagraph?.sourceZh.trim() &&
                !selectedParagraph?.draftEn.trim()
              }
            >
              <Wand2 aria-hidden="true" size={16} />
              快速翻译当前段落
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleSplitSelectedParagraph}
              disabled={!selectedSplitCandidate}
            >
              <ListChecks aria-hidden="true" size={16} />
              拆分当前段落
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleTranslateCheckedFrom("zh")}
              disabled={checkedIds.length === 0}
            >
              <Wand2 aria-hidden="true" size={16} />
              选中中文译英文
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleTranslateCheckedFrom("en")}
              disabled={checkedIds.length === 0}
            >
              <Wand2 aria-hidden="true" size={16} />
              选中英文译中文
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleClearSelected}
              disabled={!selectedParagraph}
            >
              <Eraser aria-hidden="true" size={16} />
              清空当前段落
            </button>
            <button
              className="ghost-button danger-button"
              type="button"
              onClick={handleClearAll}
              disabled={paragraphs.length === 0}
            >
              <Trash2 aria-hidden="true" size={16} />
              清空全部
            </button>
              </>
            )}
          </div>
          <p className="status-line">{status}</p>
        </header>

        <div className="pane-labels">
          <h2>中文原文</h2>
          <h2>英文稿</h2>
        </div>

        <div className="paragraph-list">
          {paragraphs.length === 0 ? (
            <div className="empty-state">
              <p>导入中文或英文主稿后，会自动识别语言并放入对应一侧。</p>
              <p className="example-text">
                示例中文段落：本文提出一种面向复杂结构疲劳分析的深度学习方法。
              </p>
              <p className="example-text">
                示例英文段落：This study proposes a deep learning method for fatigue analysis of complex structures.
              </p>
              <p className="example-text">
                长文段可直接粘贴到任意一侧，系统会按论文句子边界拆成一句一行。
              </p>
            </div>
          ) : (
            paragraphs.map((paragraph, index) => (
              <article
                className={
                  [
                    "paragraph-row",
                    paragraph.id === selectedId ? "selected" : "",
                    checkedIdSet.has(paragraph.id) ? "checked" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                data-testid={`paragraph-${paragraph.id}`}
                key={paragraph.id}
                onClick={() => setSelectedId(paragraph.id)}
              >
                {(() => {
                  const zhNotes = getParagraphNotes(paragraph, "zh");
                  const enNotes = getParagraphNotes(paragraph, "en");

                  return (
                    <>
                <div className="row-meta">
                  <input
                    aria-label={`选择段落 ${index + 1}`}
                    type="checkbox"
                    checked={checkedIdSet.has(paragraph.id)}
                    onChange={(event) =>
                      handleToggleChecked(paragraph.id, event.currentTarget.checked)
                    }
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span>{index + 1}</span>
                  <span>{statusLabels[paragraph.status]}</span>
                  <span>{getLanguageLabel(paragraph)}</span>
                </div>
                <label>
                  <span>中文段落 {index + 1}</span>
                  <textarea
                    aria-label={`中文段落 ${index + 1}`}
                    value={paragraph.sourceZh}
                    onChange={(event) =>
                      handleSourceChange(paragraph.id, event.currentTarget.value)
                    }
                    onPaste={(event) => handleParagraphPaste(event, paragraph.id, "zh")}
                  />
                </label>
                <label>
                  <span>英文段落 {index + 1}</span>
                  <textarea
                    aria-label={`英文段落 ${index + 1}`}
                    value={paragraph.draftEn}
                    onChange={(event) =>
                      handleDraftChange(paragraph.id, event.currentTarget.value)
                    }
                    onPaste={(event) => handleParagraphPaste(event, paragraph.id, "en")}
                  />
                </label>
                {zhNotes.length > 0 && (
                  <div
                    aria-label={`中文段落 ${index + 1} 修订说明`}
                    className="paragraph-notes note-zh"
                  >
                    <span>中文修订说明</span>
                    <p>{zhNotes[0].text}</p>
                  </div>
                )}
                {enNotes.length > 0 && (
                  <div
                    aria-label={`英文段落 ${index + 1} 修订说明`}
                    className="paragraph-notes note-en"
                  >
                    <span>英文修订说明</span>
                    <p>{enNotes[0].text}</p>
                  </div>
                )}
                    </>
                  );
                })()}
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="ai-panel" aria-label="AI 操作面板">
          <div className="panel-heading">
            <Sparkles aria-hidden="true" size={22} />
            <div>
              <p className="eyebrow">模型与接口</p>
              <h2>AI 写作操作</h2>
            </div>
          </div>

          {isApiSettingsOpen && (
          <div className="settings-group">
          <label className="field">
            <span>API 来源</span>
            <select
              aria-label="API 来源"
              value={provider}
              onChange={(event) =>
                handleProviderChange(event.currentTarget.value as AiProvider)
              }
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <em>示例：直接选择厂商即可一键填入接口地址和默认模型；少数代理服务可选 Custom API。</em>
          </label>

          <label className="field">
            <span>模型名称</span>
            <input
              aria-label="模型名称"
              value={model}
              onChange={(event) => handleModelChange(event.currentTarget.value)}
            />
            <em>示例：选择厂商后自动填入推荐模型；也可以手动改成你账号支持的模型名。</em>
          </label>

          <label className="field">
            <span>接口地址</span>
            <input
              aria-label="接口地址"
              value={endpoint}
              onChange={(event) => handleEndpointChange(event.currentTarget.value)}
              placeholder="https://api.deepseek.com"
            />
            <em>示例：选择厂商后自动填入官方入口；自定义接口可填写完整 chat/completions 地址。</em>
          </label>

          <label className="field">
            <span>API 密钥</span>
            <input
              aria-label="API 密钥"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.currentTarget.value)}
            />
            <em>示例：sk-...；仅保存在当前浏览器会话中。</em>
          </label>
          </div>
          )}

          <label className="field">
            <span>快速翻译来源</span>
            <select
              aria-label="快速翻译来源"
              value={quickTranslator}
              onChange={(event) =>
                setQuickTranslator(
                  event.currentTarget.value as QuickTranslationProvider
                )
              }
            >
              {quickTranslationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <em>示例：默认 Google 公共快速翻译，适合选中段落快速对照；MyMemory 可作为免密备用。</em>
          </label>

          <div className="action-group">
            <div className="action-option">
              <button
                type="button"
                onClick={() => void handleQuickTranslateSelected()}
              >
                <Wand2 aria-hidden="true" size={17} />
                快速翻译选中段落
              </button>
              <p className="example-text">示例：跳过论文风格改写，直接把当前选中段落译到另一侧。</p>
            </div>
            <div className="action-option">
              <button type="button" onClick={() => void handleAiAction("translate")}>
                <Wand2 aria-hidden="true" size={17} />
                翻译当前段落
              </button>
              <p className="example-text">示例输入：我们提出一种新的图神经网络模型。也可以输入英文让系统回译中文。</p>
            </div>
            <div className="action-option">
              <button
                type="button"
                onClick={() => void handleAiAction("polish", "zh")}
                disabled={!selectedParagraph?.sourceZh.trim()}
              >
                <Wand2 aria-hidden="true" size={17} />
                润色当前中文
              </button>
              <p className="example-text">示例输入：我们提出一种方法。适合先把中文主张改得更严谨。</p>
            </div>
            <div className="action-option">
              <button
                type="button"
                onClick={() => void handleAiAction("polish", "en")}
                disabled={!selectedParagraph?.draftEn.trim()}
              >
                <Wand2 aria-hidden="true" size={17} />
                润色当前英文
              </button>
              <p className="example-text">示例输入：We propose a new method and it works well.</p>
            </div>
            <div className="action-option">
              <button
                type="button"
                onClick={() => void handleAiAction("style-rewrite")}
              >
                <Wand2 aria-hidden="true" size={17} />
                匹配参考论文风格
              </button>
              <p className="example-text">示例目标：更像已导入论文的摘要、结果或方法部分表达。</p>
            </div>
            <div className="action-option">
              <button type="button" onClick={() => void handleAiAction("explain")}>
                <Wand2 aria-hidden="true" size={17} />
                解释修改理由
              </button>
              <p className="example-text">示例输出：说明为什么替换动词、压缩从句、统一术语。</p>
            </div>
            <div className="action-option">
              <button type="button" onClick={() => void handleBatchTranslate()}>
                <Wand2 aria-hidden="true" size={17} />
                批量补全空白侧
              </button>
              <p className="example-text">示例场景：导入英文稿后自动补中文，导入中文稿后自动补英文。</p>
            </div>
          </div>
        </aside>
    </main>
  );
}

function summarizeLanguages(paragraphs: Paragraph[]) {
  const counts = paragraphs.reduce(
    (summary, paragraph) => {
      summary[paragraph.detectedLanguage] += 1;
      return summary;
    },
    { zh: 0, en: 0, mixed: 0, empty: 0 } as Record<TextLanguage, number>
  );

  return `中文 ${counts.zh} 段，英文 ${counts.en} 段，混合 ${counts.mixed} 段`;
}

function getLanguageLabel(paragraph: Paragraph) {
  if (paragraph.sourceZh.trim() && paragraph.draftEn.trim()) return "双语";
  return languageLabels[paragraph.detectedLanguage];
}

function getParagraphNotes(paragraph: Paragraph, side: EditSide) {
  return paragraph.notes.filter((note) => note.side === side);
}

function getSplitCandidate(paragraph: Paragraph): SplitCandidate | undefined {
  const sourceSegments = splitTextIntoSegments(paragraph.sourceZh);
  const draftSegments = splitTextIntoSegments(paragraph.draftEn);

  if (
    sourceSegments.length > 1 &&
    sourceSegments.length >= draftSegments.length
  ) {
    return { side: "zh", segments: sourceSegments };
  }
  if (draftSegments.length > 1) {
    return { side: "en", segments: draftSegments };
  }

  return undefined;
}

function toParagraphNotes(notes: string[], side: EditSide): ParagraphNote[] {
  return notes.map((text) => ({ side, text }));
}

function buildCombinedTranslationSource(
  jobs: TranslationJob[],
  targetLanguage: "zh" | "en"
) {
  const targetLabel = targetLanguage === "en" ? "English" : "Chinese";
  return [
    `Translate the following ${jobs.length} numbered academic paragraphs into ${targetLabel}.`,
    "Return exactly one translated paragraph for each input paragraph.",
    "Keep the same [1], [2], ... markers and keep the original order.",
    "Do not merge, omit, summarize, or add extra commentary.",
    "",
    ...jobs.map((job, index) => `[${index + 1}] ${job.sourceText}`)
  ].join("\n");
}

function splitCombinedGeneratedText(text: string, expectedCount: number) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const markerRegex =
    /(?:^|\n)\s*(?:\[(\d+)\]|(?:段落|Paragraph)\s*(\d+)|(\d+)[.)、:：])\s*/gi;
  const matches = [...trimmed.matchAll(markerRegex)];
  if (matches.length >= expectedCount) {
    const segments = Array.from({ length: expectedCount }, () => "");
    matches.forEach((match, index) => {
      const markerNumber = Number(match[1] ?? match[2] ?? match[3]);
      if (!Number.isFinite(markerNumber)) return;
      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length ? matches[index + 1].index ?? trimmed.length : trimmed.length;
      if (markerNumber >= 1 && markerNumber <= expectedCount) {
        segments[markerNumber - 1] = trimmed.slice(start, end).trim();
      }
    });

    if (segments.every(Boolean)) return segments;
  }

  const paragraphChunks = trimmed
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (paragraphChunks.length >= expectedCount) {
    return paragraphChunks.slice(0, expectedCount);
  }

  return expectedCount === 1 ? [trimmed] : paragraphChunks;
}

function splitGeneratedText(result: AiResult): GeneratedText {
  const text = result.text.trim();
  const noteMatch =
    text.match(
      /(?:^|(?:\r?\n)+)\s*((?:修订说明|修改说明|润色说明|Revision notes?|Notes?)\s*[:：]\s*[\s\S]+)$/i
    ) ??
    text.match(/(?:^|(?:\r?\n)+)\s*(说明\s*[:：]\s*[\s\S]+)$/i);

  if (!noteMatch || noteMatch.index === undefined) {
    return {
      text,
      notes: []
    };
  }

  return {
    text: text.slice(0, noteMatch.index).trim(),
    notes: [noteMatch[1].trim()]
  };
}
