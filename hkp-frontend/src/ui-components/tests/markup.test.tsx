import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Markup, {
  parseInlineMarkup,
  splitParagraphs,
  stripMarkup,
} from "hkp-frontend/src/ui-components/Markup";

/**
 * What a written description is allowed to say, and what stays the text
 * somebody typed.
 */

describe("splitParagraphs", () => {
  it("breaks on a blank line", () => {
    expect(splitParagraphs("one\n\ntwo")).toEqual(["one", "two"]);
  });

  it("reads a single newline as a wrap, not a break", () => {
    expect(splitParagraphs("one\ntwo")).toEqual(["one two"]);
  });

  it("drops the empty paragraphs a run of blank lines leaves", () => {
    expect(splitParagraphs("one\n\n  \n\ntwo\n\n")).toEqual(["one", "two"]);
  });
});

describe("parseInlineMarkup", () => {
  const kinds = (text: string) =>
    parseInlineMarkup(text).map((s) => [s.kind, s.value]);

  it("reads bold, italic and inline code", () => {
    expect(kinds("**Reader** is *the* `rss` board")).toEqual([
      ["bold", "Reader"],
      ["text", " is "],
      ["italic", "the"],
      ["text", " "],
      ["code", "rss"],
      ["text", " board"],
    ]);
  });

  it("takes an underscore pair as italic", () => {
    expect(kinds("a _quiet_ word")).toEqual([
      ["text", "a "],
      ["italic", "quiet"],
      ["text", " word"],
    ]);
  });

  it("leaves an underscore inside a word alone", () => {
    expect(kinds("the mount_secret_file")).toEqual([
      ["text", "the mount_secret_file"],
    ]);
  });

  it("leaves an asterisk that opens or closes on a space alone", () => {
    expect(kinds("2 * 3 * 4")).toEqual([["text", "2 * 3 * 4"]]);
  });

  it("leaves an unclosed marker alone", () => {
    expect(kinds("a *.json glob")).toEqual([["text", "a *.json glob"]]);
  });

  it("keeps the text of a description that has no markup at all", () => {
    expect(kinds("plain prose")).toEqual([["text", "plain prose"]]);
  });
});

describe("stripMarkup", () => {
  it("returns the text without its markers, on one line", () => {
    expect(stripMarkup("**Reader** is the board.\n\nIt reads `feeds`.")).toBe(
      "Reader is the board. It reads feeds.",
    );
  });
});

describe("Markup", () => {
  it("renders bold as bold rather than as asterisks", () => {
    const { container } = render(<Markup text="**Reader** is the board" />);
    expect(container.querySelector("strong")?.textContent).toBe("Reader");
    expect(container.textContent).toBe("Reader is the board");
  });

  it("gives a blank line its own paragraph", () => {
    const { container } = render(<Markup text={"first\n\nsecond"} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("first");
    expect(paragraphs[1].textContent).toBe("second");
  });

  it("renders inline code in a code element", () => {
    render(<Markup text="calls `voice.speech`" />);
    expect(screen.getByText("voice.speech").tagName).toBe("CODE");
  });

  it("does not turn markup into markup-bearing HTML", () => {
    const { container } = render(
      <Markup text={"<img src=x onerror=alert(1)>"} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
