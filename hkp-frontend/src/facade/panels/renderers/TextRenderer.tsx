import { useCallback, useEffect, useRef, useState } from "react";
import { TextWidget } from "../../types";
import { extractText } from "../../readValue";
import { copyToClipboard } from "hkp-frontend/src/clipboard";
import { WidgetRendererProps } from "../widgetRegistry";
import { usePressFeedback } from "../../pressFeedback";
import { useNotificationValue } from "./StatusIndicatorRenderer";

/**
 * Whatever a service is saying, as text.
 *
 * The facade's other widgets each render one kind of thing — a level, a table,
 * a dot. This one renders the thing itself, which is what a panel needs
 * whenever the interesting part of a service's answer is words: why something
 * failed, what a model wrote, how many of something there are.
 *
 * It reads its value the same way `status-indicator` does, so it shows what the
 * service already holds on load rather than staying blank until the next
 * notification — which for an error is the difference between seeing the reason
 * and seeing nothing at all.
 *
 * Three things a value can be beyond prose, and each is one option rather than
 * a widget of its own: a value whose point is to be taken somewhere else is
 * `copyable`, a value laid out in characters — ASCII art, a table a service
 * drew itself — sets `wrap: false` so its columns survive a narrow panel, and a
 * value that names something to open carries an `href`.
 *
 * With no source it is a fixed line of prose, which is the same widget with
 * nothing ever arriving to replace the placeholder.
 */

const TONES: Record<NonNullable<TextWidget["tone"]>, string> = {
  normal: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  error: "#ef4444",
};

function CopyButton({ value }: { value: string }) {
  const press = usePressFeedback("neutral", !value);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    if (!(await copyToClipboard(value))) {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  }, [value]);

  return (
    <button
      {...press.handlers}
      onClick={copy}
      disabled={!value}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        // Longhand: the press feedback sets backgroundColor and borderColor,
        // and React warns when a shorthand is mixed with the value it covers.
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--muted))",
        color: "hsl(var(--foreground))",
        cursor: value ? "pointer" : "default",
        opacity: value ? 1 : 0.5,
        fontSize: 11,
        fontWeight: 500,
        flexShrink: 0,
        ...press.style,
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function TextRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<TextWidget>) {
  const value = useNotificationValue(boardContext, widget.source);
  const text = extractText(value, undefined, widget.pretty);
  const shown = text && text.trim() ? text : (widget.placeholder ?? "");
  const isPlaceholder = !(text && text.trim());
  const wraps = widget.wrap !== false;
  // With no source the placeholder is the text itself; with one it stands in
  // for a value that has not arrived.
  const standingIn = !!widget.source && isPlaceholder;
  // A link only where there is both somewhere to go and something to click.
  // Offering a stood-in placeholder as a link is worse than plain text: it
  // dresses up an absent value as something to open.
  const links = !!widget.href && !!shown.trim() && !standingIn;

  const body = (
    <div
      style={{
        // The accent says the text is a way somewhere, which is the one thing
        // a reader cannot tell from an underline they have to hover to see. A
        // tone the board asked for still wins — it was asked for.
        color: isPlaceholder
          ? TONES.muted
          : links && !widget.tone
            ? "var(--hkp-accent)"
            : TONES[widget.tone ?? "normal"],
        fontSize: widget.fontSize ?? 13,
        fontFamily: widget.mono ? "var(--font-mono, monospace)" : undefined,
        // A message is prose, not a cell: it wraps, and keeps the line breaks a
        // service put in it. A value that is laid out in characters does not
        // wrap — a broken line there is a wrong line — and scrolls instead.
        whiteSpace: wraps ? "pre-wrap" : "pre",
        overflowWrap: wraps ? "anywhere" : undefined,
        overflowX: wraps ? undefined : "auto",
        lineHeight: widget.lineHeight ?? 1.45,
        minWidth: 0,
        flex: widget.copyable ? 1 : undefined,
      }}
    >
      {widget.label ? (
        // The caption stays muted whatever tone the value carries, so the value
        // is what the eye lands on.
        <span style={{ color: TONES.muted, marginRight: 4 }}>
          {widget.label}
        </span>
      ) : null}
      {shown}
    </div>
  );

  const linked = links ? (
    <a
      href={widget.href}
      target="_blank"
      rel="noreferrer noopener"
      // The colour is the body's, so that a tone the board set still applies;
      // this element is the click target and nothing more.
      style={{
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
        flex: widget.copyable ? 1 : undefined,
      }}
    >
      {body}
    </a>
  ) : (
    body
  );

  if (!widget.copyable) {
    return linked;
  }

  return (
    // inline-flex so the button sits beside a short value rather than at the
    // far edge of the panel; the value still takes the width it needs.
    <div
      style={{
        display: "inline-flex",
        maxWidth: "100%",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      {linked}
      <CopyButton value={isPlaceholder ? "" : (text ?? "")} />
    </div>
  );
}
