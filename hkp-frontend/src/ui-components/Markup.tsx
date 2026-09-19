import { CSSProperties } from "react";

/**
 * The light markup a written description may use: paragraphs, bold, italic
 * and inline code.
 *
 * Descriptions are prose somebody typed into a JSON document, so they are
 * parsed into React elements rather than assembled into an HTML string — a
 * document that arrives by import, link or drop can then say nothing that the
 * page will execute. Nothing here produces an element with an attribute the
 * text controls.
 *
 * Emphasis does not nest and there is no escape character; both would need a
 * real markdown parser, and neither is expressible in what a description is.
 */

const MONO_FONT =
  "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace";

/**
 * Bold, italic (either delimiter) and inline code.
 *
 * An emphasis run must start and end on a non-space character, so arithmetic
 * ("2 * 3 * 4") and glob patterns are read as the text they are.
 */
const INLINE_MARKUP =
  /\*\*(\S(?:[^*]*\S)?)\*\*|\*(\S(?:[^*\n]*\S)?)\*|_(\S(?:[^_\n]*\S)?)_|`([^`\n]+)`/g;

export type MarkupSegment = {
  kind: "text" | "bold" | "italic" | "code";
  value: string;
};

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /\w/.test(char);
}

/**
 * Splits prose into paragraphs on a blank line. A single newline is a wrap in
 * the source rather than a break in the text, and becomes a space.
 */
export function splitParagraphs(text: string): Array<string> {
  return text
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** One paragraph's worth of text, as the runs of plain and marked-up text it is made of. */
export function parseInlineMarkup(text: string): Array<MarkupSegment> {
  const segments: Array<MarkupSegment> = [];
  let plain = "";

  const flushPlain = () => {
    if (plain) {
      segments.push({ kind: "text", value: plain });
      plain = "";
    }
  };

  const pattern = new RegExp(INLINE_MARKUP.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const end = match.index + match[0].length;
    // An underscore inside a word is part of the word — snake_case, a file
    // name — and not emphasis.
    if (
      match[3] !== undefined &&
      (isWordChar(text[match.index - 1]) || isWordChar(text[end]))
    ) {
      plain += text.slice(cursor, match.index + 1);
      cursor = match.index + 1;
      pattern.lastIndex = cursor;
      continue;
    }

    plain += text.slice(cursor, match.index);
    flushPlain();
    if (match[1] !== undefined) {
      segments.push({ kind: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: "italic", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ kind: "italic", value: match[3] });
    } else {
      segments.push({ kind: "code", value: match[4] });
    }
    cursor = end;
    pattern.lastIndex = cursor;
  }

  plain += text.slice(cursor);
  flushPlain();
  return segments;
}

/** The same text with its markers removed, for somewhere a single line is all there is room for. */
export function stripMarkup(text: string): string {
  return splitParagraphs(text)
    .map((paragraph) =>
      parseInlineMarkup(paragraph)
        .map((segment) => segment.value)
        .join(""),
    )
    .join(" ");
}

export function InlineMarkup({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkup(text).map((segment, idx) => {
        const key = `markup-${idx}`;
        switch (segment.kind) {
          case "bold":
            return <strong key={key}>{segment.value}</strong>;
          case "italic":
            return <em key={key}>{segment.value}</em>;
          case "code":
            return (
              <code
                key={key}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: "0.92em",
                  padding: "0 4px",
                  borderRadius: 3,
                  // Neutral enough to sit on either a light or a dark ground.
                  background: "rgba(127, 127, 127, 0.16)",
                }}
              >
                {segment.value}
              </code>
            );
          default:
            return <span key={key}>{segment.value}</span>;
        }
      })}
    </>
  );
}

type Props = {
  text: string;
  className?: string;
  style?: CSSProperties;
};

export default function Markup({ text, className, style }: Props) {
  const paragraphs = splitParagraphs(text);
  return (
    <div className={className} style={style}>
      {paragraphs.map((paragraph, idx) => (
        <p
          key={`markup-paragraph-${idx}`}
          style={{
            margin: 0,
            marginBottom: idx < paragraphs.length - 1 ? "0.7em" : 0,
          }}
        >
          <InlineMarkup text={paragraph} />
        </p>
      ))}
    </div>
  );
}
