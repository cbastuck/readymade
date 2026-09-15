import { ReactNode, useState } from "react";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeStateRef, FacadeWidgetSource, LayoutContainer } from "../types";
import { useFacadeState } from "../FacadeStateContext";
import { usePressFeedback } from "../pressFeedback";
import { useNotificationValue } from "./renderers/StatusIndicatorRenderer";

/**
 * A group of widgets folded behind a header row.
 *
 * A panel's space is spent on whatever is drawn, whether or not anybody is
 * using it: three empty editors for the parts of a request most people never
 * set will push the verb buttons off the bottom of the screen. Folding them
 * costs one row each and puts the controls that matter back above the fold.
 *
 * Which is only safe if a closed section still says what is inside it — a
 * header hidden behind a fold is a header you will not remember setting. That
 * is what `summary` is for.
 */

function isStateRef(
  value: FacadeWidgetSource | FacadeStateRef | undefined,
): value is FacadeStateRef {
  return !!value && "$state" in value;
}

/** A count for something with parts, the value itself for anything else. */
export function summaryText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return String(value.length);
  }
  if (typeof value === "object") {
    return String(Object.keys(value as object).length);
  }
  return String(value);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(90deg)" : undefined,
        transition: "transform 0.15s",
        flexShrink: 0,
      }}
    >
      <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CollapsibleSection({
  container,
  boardContext,
  children,
}: {
  container: LayoutContainer;
  boardContext: BoardContextState;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!container.open);
  const press = usePressFeedback("neutral");
  const { state: facadeState } = useFacadeState();

  // Both sources are read every render — a hook cannot be called conditionally,
  // and the unused one costs nothing.
  const notified = useNotificationValue(
    boardContext,
    isStateRef(container.summary) ? undefined : container.summary,
  );
  const summary = summaryText(
    isStateRef(container.summary)
      ? facadeState[container.summary.$state]
      : notified,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <button
        {...press.handlers}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 8px",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "transparent",
          borderRadius: 6,
          backgroundColor: "transparent",
          color: "hsl(var(--muted-foreground))",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "left",
          ...press.style,
        }}
      >
        <Chevron open={open} />
        <span style={{ flex: 1, minWidth: 0 }}>{container.title}</span>
        {summary ? (
          <span
            style={{
              fontWeight: 500,
              letterSpacing: 0,
              textTransform: "none",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {summary}
          </span>
        ) : null}
      </button>
      {open ? children : null}
    </div>
  );
}
