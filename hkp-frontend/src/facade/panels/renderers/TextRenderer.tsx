import { TextWidget } from "../../types";
import { extractText } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";
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
 */

const TONES: Record<NonNullable<TextWidget["tone"]>, string> = {
  normal: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  error: "#ef4444",
};

export function TextRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<TextWidget>) {
  const value = useNotificationValue(boardContext, widget.source);
  const text = extractText(value, undefined);
  const shown = text && text.trim() ? text : (widget.placeholder ?? "");
  const isPlaceholder = !(text && text.trim());

  return (
    <div
      style={{
        color: isPlaceholder ? TONES.muted : TONES[widget.tone ?? "normal"],
        fontSize: widget.fontSize ?? 13,
        fontFamily: widget.mono ? "var(--font-mono, monospace)" : undefined,
        // A message is prose, not a cell: it wraps, and keeps the line breaks a
        // service put in it.
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        lineHeight: 1.45,
      }}
    >
      {shown}
    </div>
  );
}
