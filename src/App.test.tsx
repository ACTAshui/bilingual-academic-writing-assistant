import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App workbench", () => {
  it("renders the integrated manuscript workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Bilingual Academic Writer/i })).toBeInTheDocument();
    expect(screen.getByText("Manuscript")).toBeInTheDocument();
    expect(screen.getByText("Reference Library")).toBeInTheDocument();
    expect(screen.getByText("Chinese Source")).toBeInTheDocument();
    expect(screen.getByText("English Draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toHaveDisplayValue("Mock local assistant");
    expect(screen.getByRole("button", { name: "Download English TXT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Bilingual TXT" })).toBeInTheDocument();
  });

  it("imports a manuscript into synchronized Chinese and English panes", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("Import manuscript"),
      new File(["第一段。\n\n第二段。"], "paper.txt", { type: "text/plain" })
    );

    expect(await screen.findByDisplayValue("第一段。")).toBeInTheDocument();
    expect(screen.getByDisplayValue("第二段。")).toBeInTheDocument();
    expect(screen.getByText("2 paragraphs")).toBeInTheDocument();
  });

  it("adds reference papers and updates the style profile", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("Add reference papers"),
      new File(
        [
          "The proposed framework improves accuracy. Experimental results demonstrate robust performance. Finite element analysis was used."
        ],
        "reference.txt",
        { type: "text/plain" }
      )
    );

    expect(await screen.findByText("1 / 10 references")).toBeInTheDocument();
    expect(screen.getByText(/finite element analysis/i)).toBeInTheDocument();
  });

  it("runs mock AI translation for the selected paragraph", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("Import manuscript"),
      new File(["我们提出一种方法。"], "paper.txt", { type: "text/plain" })
    );
    await user.click(screen.getByRole("button", { name: "Translate selected" }));

    const englishPane = screen.getByLabelText("English paragraph 1");
    expect((englishPane as HTMLTextAreaElement).value).toContain(
      "Academic translation"
    );
  });

  it("lets the user edit paired paragraphs directly", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.upload(
      screen.getByLabelText("Import manuscript"),
      new File(["原文。"], "paper.txt", { type: "text/plain" })
    );
    const paragraph = screen.getByLabelText("English paragraph 1");
    await user.type(paragraph, "Edited academic sentence.");

    expect(paragraph).toHaveValue("Edited academic sentence.");
    expect(within(screen.getByTestId("paragraph-p-1")).getByText("edited")).toBeInTheDocument();
  });
});
