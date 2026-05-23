import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App workbench", () => {
  it("renders the Chinese manuscript workbench with examples", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /双语学术写作助手/i })
    ).toBeInTheDocument();
    expect(screen.getByText("主稿导入")).toBeInTheDocument();
    expect(screen.getByText("参考论文库")).toBeInTheDocument();
    expect(screen.getByText("中文原文")).toBeInTheDocument();
    expect(screen.getByText("英文稿")).toBeInTheDocument();
    expect(screen.getByLabelText("API 来源")).toHaveDisplayValue("DeepSeek API");
    expect(screen.getByLabelText("模型名称")).toHaveValue("deepseek-v4-pro");
    expect(screen.getByLabelText("接口地址")).toHaveValue("https://api.deepseek.com");
    expect(screen.getByRole("button", { name: "下载英文 TXT" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下载双语对照 TXT" })
    ).toBeInTheDocument();
    expect(screen.getByText(/示例：上传/)).toBeInTheDocument();
    expect(screen.getByText(/选择厂商后自动填入推荐模型/)).toBeInTheDocument();
    expect(screen.getByText(/示例输入：我们提出一种新的图神经网络模型/)).toBeInTheDocument();
  });

  it("imports a manuscript into synchronized Chinese and English panes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["第一段。\n\n第二段。"], "paper.txt", { type: "text/plain" })
    );

    expect(await screen.findByDisplayValue("第一段。")).toBeInTheDocument();
    expect(screen.getByDisplayValue("第二段。")).toBeInTheDocument();
    expect(screen.getByText("2 个段落")).toBeInTheDocument();
  });

  it("exports Chinese text from the selected paragraph range", async () => {
    let downloadedBlob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return "blob:download";
      }),
      revokeObjectURL: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["第一段。\n\n第二段。\n\n第三段。"], "paper.txt", {
        type: "text/plain"
      })
    );

    expect(screen.getByText("总段数：3")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("导出起始段"));
    await user.type(screen.getByLabelText("导出起始段"), "2");
    await user.clear(screen.getByLabelText("导出结束段"));
    await user.type(screen.getByLabelText("导出结束段"), "3");
    await user.click(screen.getByRole("button", { name: "下载中文 TXT" }));

    await waitFor(() => expect(downloadedBlob).toBeDefined());
    expect(downloadedBlob?.size).toBe(new Blob(["第二段。\n\n第三段。"]).size);
    expect(downloadedBlob?.type).toBe("text/plain;charset=utf-8");
    expect(screen.getByText(/已准备下载：chinese-draft.txt/)).toBeInTheDocument();
  });

  it("imports an English manuscript into the English pane", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(
        ["This study proposes a graph neural network for fatigue analysis."],
        "paper.txt",
        { type: "text/plain" }
      )
    );

    expect(
      await screen.findByDisplayValue(
        "This study proposes a graph neural network for fatigue analysis."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("中文段落 1")).toHaveValue("");
    expect(screen.getByText("英文")).toBeInTheDocument();
  });

  it("imports pasted long text as one paragraph when requested", async () => {
    render(<App />);
    const longParagraph =
      "第一句说明研究目标。第二句继续说明方法。第三句保留在同一个段落中。";

    fireEvent.change(screen.getByLabelText("长文本粘贴区"), {
      target: { value: longParagraph }
    });
    fireEvent.click(screen.getByRole("button", { name: "作为一段导入" }));

    expect(screen.getByLabelText("中文段落 1")).toHaveValue(longParagraph);
    expect(screen.queryByLabelText("中文段落 2")).not.toBeInTheDocument();
    expect(screen.getByText("1 个段落")).toBeInTheDocument();
    expect(screen.getByText(/已作为 1 段导入/)).toBeInTheDocument();
  });

  it("imports pasted long text as separated sentence rows when requested", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("长文本粘贴区"), {
      target: {
        value: "第一句说明研究目标。第二句继续说明方法。第三句给出结果。"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "按句拆分导入" }));

    expect(screen.getByLabelText("中文段落 1")).toHaveValue("第一句说明研究目标。");
    expect(screen.getByLabelText("中文段落 2")).toHaveValue("第二句继续说明方法。");
    expect(screen.getByLabelText("中文段落 3")).toHaveValue("第三句给出结果。");
    expect(screen.getByText("3 个段落")).toBeInTheDocument();
  });

  it("waits four seconds after manual edits before API auto-translating", async () => {
    stubChatCompletions(
      "Translated English sentence.",
      "本研究提出了一种稳健的框架。"
    );
    const user = userEvent.setup();
    render(<App />);

    fireEvent.change(screen.getByLabelText("API 密钥"), {
      target: { value: "sk-test" }
    });

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["原文。"], "paper.txt", { type: "text/plain" })
    );
    expect(screen.getByLabelText("自动翻译方式")).toHaveDisplayValue("API 自动翻译");

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("中文段落 1"), {
      target: { value: "我们提出一种新的图神经网络模型。" }
    });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3999);
    });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(
      (screen.getByLabelText("英文段落 1") as HTMLTextAreaElement).value
    ).toContain("Translated English sentence.");
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("英文段落 1"), {
      target: { value: "This study proposes a robust framework." }
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(
      (screen.getByLabelText("中文段落 1") as HTMLTextAreaElement).value
    ).toContain("本研究提出了一种稳健的框架。");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses quick auto translation without an API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          [["This study proposes a robust framework.", "本研究提出了一种稳健的框架。"]]
        ])
      )
    );
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("自动翻译方式"), "quick");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["原文。"], "paper.txt", { type: "text/plain" })
    );

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("中文段落 1"), {
      target: { value: "本研究提出了一种稳健的框架。" }
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.getByLabelText("英文段落 1")).toHaveValue(
      "This study proposes a robust framework."
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("translate.googleapis.com")
    );
  });

  it("hides only API settings while keeping AI actions available", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText("AI 操作面板")).toBeInTheDocument();
    expect(screen.getByLabelText("API 来源")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "隐藏 API 设置" }));
    expect(screen.getByLabelText("AI 操作面板")).toBeInTheDocument();
    expect(screen.queryByLabelText("API 来源")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "翻译当前段落" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "显示 API 设置" }));
    expect(screen.getByLabelText("API 来源")).toBeInTheDocument();
  });

  it("hides and shows the left project rail and toolbar actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByLabelText("项目侧栏")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全选" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "隐藏左栏" }));
    expect(screen.queryByLabelText("项目侧栏")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示左栏" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "隐藏工具" }));
    expect(screen.queryByRole("button", { name: "全选" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示工具" })).toBeInTheDocument();
  });

  it("clears the selected paragraph with a dedicated button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["原文。"], "paper.txt", { type: "text/plain" })
    );
    await user.selectOptions(screen.getByLabelText("自动翻译方式"), "off");
    await user.type(screen.getByLabelText("英文段落 1"), "Edited sentence.");
    await user.click(screen.getByRole("button", { name: "清空当前段落" }));

    expect(screen.getByLabelText("中文段落 1")).toHaveValue("");
    expect(screen.getByLabelText("英文段落 1")).toHaveValue("");
  });

  it("splits a pasted long paragraph into sentence rows", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["占位。"], "paper.txt", { type: "text/plain" })
    );
    await user.selectOptions(screen.getByLabelText("自动翻译方式"), "off");

    fireEvent.paste(screen.getByLabelText("中文段落 1"), {
      clipboardData: {
        getData: () => "第一句。第二句说明方法。第三句给出结果。"
      }
    });

    expect(screen.getByLabelText("中文段落 1")).toHaveValue("第一句。");
    expect(screen.getByLabelText("中文段落 2")).toHaveValue("第二句说明方法。");
    expect(screen.getByLabelText("中文段落 3")).toHaveValue("第三句给出结果。");
    expect(screen.getByText("3 个段落")).toBeInTheDocument();
    expect(screen.getByText(/已拆分为 3 个句子/)).toBeInTheDocument();
  });

  it("splits the selected paragraph from the toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["占位。"], "paper.txt", { type: "text/plain" })
    );
    await user.selectOptions(screen.getByLabelText("自动翻译方式"), "off");
    fireEvent.change(screen.getByLabelText("英文段落 1"), {
      target: {
        value: "This method is robust. It improves fatigue prediction."
      }
    });

    await user.click(screen.getByRole("button", { name: "拆分当前段落" }));

    expect(screen.getByLabelText("英文段落 1")).toHaveValue(
      "This method is robust."
    );
    expect(screen.getByLabelText("英文段落 2")).toHaveValue(
      "It improves fatigue prediction."
    );
    expect(screen.getByLabelText("中文段落 1")).toHaveValue("");
    expect(screen.getByText("2 个段落")).toBeInTheDocument();
  });

  it("adds reference papers and updates the style profile", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("添加参考论文"),
      new File(
        [
          "The proposed framework improves accuracy. Experimental results demonstrate robust performance. Finite element analysis was used."
        ],
        "reference.txt",
        { type: "text/plain" }
      )
    );

    expect(await screen.findByText("1 / 10 篇参考论文")).toBeInTheDocument();
    expect(screen.getAllByText(/finite element analysis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/已从 1 篇参考论文提取风格线索/)).toBeInTheDocument();
  });

  it("runs the selected API translation for the selected paragraph", async () => {
    stubChatCompletions("The proposed method is introduced.");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["我们提出一种方法。"], "paper.txt", { type: "text/plain" })
    );
    await user.click(screen.getByRole("button", { name: "翻译当前段落" }));

    const englishPane = screen.getByLabelText("英文段落 1");
    await waitFor(() =>
      expect((englishPane as HTMLTextAreaElement).value).toContain(
        "The proposed method is introduced."
      )
    );
  });

  it("keeps revision notes out of the editable manuscript text", async () => {
    stubChatCompletions("The proposed method is introduced.\n\n修订说明：压缩句子并使用更正式的动词。");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["我们提出一种方法。"], "paper.txt", { type: "text/plain" })
    );
    await user.click(screen.getByRole("button", { name: "翻译当前段落" }));

    await waitFor(() =>
      expect(screen.getByLabelText("英文段落 1")).toHaveValue(
        "The proposed method is introduced."
      )
    );
    expect(screen.getByLabelText("英文段落 1 修订说明")).toHaveTextContent(
      "修订说明：压缩句子并使用更正式的动词。"
    );
  });

  it("shows standalone revision notes without replacing existing draft text", async () => {
    stubChatCompletions("修订说明：建议保留技术术语并补充约束条件。");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["This study proposes a robust framework."], "paper.txt", {
        type: "text/plain"
      })
    );
    await user.click(screen.getByRole("button", { name: "润色当前英文" }));

    await waitFor(() =>
      expect(screen.getByLabelText("英文段落 1")).toHaveValue(
        "This study proposes a robust framework."
      )
    );
    expect(screen.getByLabelText("英文段落 1 修订说明")).toHaveTextContent(
      "修订说明：建议保留技术术语并补充约束条件。"
    );
  });

  it("revises the current Chinese paragraph and shows its note below the row", async () => {
    stubChatCompletions("本文提出一种更严谨的方法。\n\n修订说明：压缩表达并保留核心术语。");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["我们提出一种方法。"], "paper.txt", { type: "text/plain" })
    );
    await user.click(screen.getByRole("button", { name: "润色当前中文" }));

    await waitFor(() =>
      expect(screen.getByLabelText("中文段落 1")).toHaveValue(
        "本文提出一种更严谨的方法。"
      )
    );
    expect(screen.getByLabelText("英文段落 1")).toHaveValue("");
    expect(
      within(screen.getByTestId("paragraph-p-1")).getByLabelText("中文段落 1 修订说明")
    ).toHaveTextContent("修订说明：压缩表达并保留核心术语。");
  });

  it("translates checked paragraphs in one ordered request from the current translate button", async () => {
    stubChatCompletions(
      "[1] The first method is proposed.\n\n[2] The second experiment is conducted.\n\n[3] The third result is analyzed."
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["提出第一种方法。\n\n开展第二个实验。\n\n分析第三个结果。"], "paper.txt", {
        type: "text/plain"
      })
    );

    await user.click(await screen.findByLabelText("选择段落 1"));
    await user.click(screen.getByLabelText("选择段落 2"));
    await user.click(screen.getByLabelText("选择段落 3"));
    await user.click(screen.getByRole("button", { name: "翻译当前段落" }));

    await waitFor(() => {
      expect(screen.getByLabelText("英文段落 1")).toHaveValue(
        "The first method is proposed."
      );
      expect(screen.getByLabelText("英文段落 2")).toHaveValue(
        "The second experiment is conducted."
      );
      expect(screen.getByLabelText("英文段落 3")).toHaveValue(
        "The third result is analyzed."
      );
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("revises the current English paragraph", async () => {
    stubChatCompletions("This study proposes a rigorous method.");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["This study proposes a method."], "paper.txt", {
        type: "text/plain"
      })
    );
    await user.click(screen.getByRole("button", { name: "润色当前英文" }));

    await waitFor(() =>
      expect(screen.getByLabelText("英文段落 1")).toHaveValue(
        "This study proposes a rigorous method."
      )
    );
  });

  it("quick-translates the selected paragraph with the public translator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          [["This study proposes a robust framework.", "本研究提出了一种稳健的框架。"]]
        ])
      )
    );
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["本研究提出了一种稳健的框架。"], "paper.txt", {
        type: "text/plain"
      })
    );
    await user.click(screen.getByRole("button", { name: "快速翻译当前段落" }));

    await waitFor(() =>
      expect(screen.getByLabelText("英文段落 1")).toHaveValue(
        "This study proposes a robust framework."
      )
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("translate.googleapis.com")
    );
  });

  it("fills endpoint and model when a provider preset is selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("API 来源"), "qwen");

    expect(screen.getByLabelText("API 来源")).toHaveDisplayValue(
      "Qwen DashScope（通义千问）"
    );
    expect(screen.getByLabelText("模型名称")).toHaveValue("qwen-plus");
    expect(screen.getByLabelText("接口地址")).toHaveValue(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    );
  });

  it("overwrites a bad Chinese pane by translating from the English pane", async () => {
    stubChatCompletions("本研究提出了一种稳健的框架。");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["This study proposes a robust framework."], "paper.txt", {
        type: "text/plain"
      })
    );
    fireEvent.change(screen.getByLabelText("中文段落 1"), {
      target: { value: "中文学术译文：This study proposes a robust framework." }
    });
    await user.click(screen.getByRole("button", { name: "英文译中文" }));

    await waitFor(() =>
      expect(screen.getByLabelText("中文段落 1")).toHaveValue(
        "本研究提出了一种稳健的框架。"
      )
    );
  });

  it("translates checked English paragraphs into Chinese in bulk", async () => {
    stubChatCompletions("第一段译文。", "第二段译文。");
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["First English paragraph.\n\nSecond English paragraph."], "paper.txt", {
        type: "text/plain"
      })
    );

    await user.click(await screen.findByLabelText("选择段落 1"));
    await user.click(screen.getByLabelText("选择段落 2"));
    await user.click(screen.getByRole("button", { name: "选中英文译中文" }));

    await waitFor(() => {
      expect(screen.getByLabelText("中文段落 1")).toHaveValue("第一段译文。");
      expect(screen.getByLabelText("中文段落 2")).toHaveValue("第二段译文。");
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("starts selected batch translations concurrently", async () => {
    const deferredResponses = [
      createDeferredResponse("第一段译文。"),
      createDeferredResponse("第二段译文。"),
      createDeferredResponse("第三段译文。")
    ];
    const responseQueue = [...deferredResponses];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => responseQueue.shift()?.promise ?? Promise.reject())
    );
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("API 密钥"), "sk-test");
    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(
        ["First paragraph.\n\nSecond paragraph.\n\nThird paragraph."],
        "paper.txt",
        { type: "text/plain" }
      )
    );

    await user.click(screen.getByRole("button", { name: "全选" }));
    await user.click(screen.getByRole("button", { name: "选中英文译中文" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    deferredResponses.forEach((deferred) => deferred.resolve());
    await waitFor(() => {
      expect(screen.getByLabelText("中文段落 1")).toHaveValue("第一段译文。");
      expect(screen.getByLabelText("中文段落 2")).toHaveValue("第二段译文。");
      expect(screen.getByLabelText("中文段落 3")).toHaveValue("第三段译文。");
    });
  });

  it("lets the user edit paired paragraphs directly", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("导入主稿"),
      new File(["原文。"], "paper.txt", { type: "text/plain" })
    );
    await user.selectOptions(screen.getByLabelText("自动翻译方式"), "off");
    const paragraph = screen.getByLabelText("英文段落 1");
    await user.type(paragraph, "Edited academic sentence.");

    expect(paragraph).toHaveValue("Edited academic sentence.");
    expect(within(screen.getByTestId("paragraph-p-1")).getByText("已编辑")).toBeInTheDocument();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubChatCompletions(...translations: string[]) {
  const queue = [...translations];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: queue.shift() ?? translations.at(-1) ?? ""
            }
          }
        ]
      })
    )
  );
}

function createDeferredResponse(text: string) {
  let resolve!: () => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = () =>
      innerResolve(
        Response.json({
          choices: [{ message: { content: text } }]
        })
      );
  });
  return { promise, resolve };
}
