import { useMemo, useState } from "react";

import { CalendarWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useWidgetActions } from "../../useWidgetActions";
import { interpolateTemplate } from "../../itemTemplate";
import { useNotificationValue } from "./StatusIndicatorRenderer";

/**
 * A day as a calendar.
 *
 * Drawn rather than assembled: the hours are an axis, not a column of labels,
 * and a cell's position is what says when it is. A grid of buttons can carry the
 * same information and still not read as a timetable — the eye looks *down* a
 * column to find a free afternoon, which only works if the hours line up and the
 * rows are the same height whatever is in them.
 *
 * What it does not do is decide anything. Every cell arrives already knowing
 * what it says, whose it is and whether it is on offer, because the service that
 * answered knows all three and this does not.
 */

type Cell = {
  column: number;
  hour: number;
  state: string;
  label?: unknown;
  [key: string]: unknown;
};

/** Cells that can be acted on. The rest are there to be read. */
const TAPPABLE = new Set(["free", "mine"]);

/** The space between two cells, across a row and down a column alike. */
const ROW_GAP = 4;

/**
 * What a cell says when the row did not say.
 *
 * A free hour carries a mark rather than nothing. Drawn empty it is
 * indistinguishable from an hour that is merely not on offer, and a person
 * looking for somewhere to click finds an outline that gives no sign of being a
 * control at all.
 */
const DEFAULT_LABEL: Record<string, string> = {
  free: "+",
  mine: "You",
  taken: "",
  blocked: "",
};

function isCell(row: unknown): row is Cell {
  if (row === null || typeof row !== "object") {
    return false;
  }
  const r = row as Record<string, unknown>;
  return typeof r.column === "number" && typeof r.hour === "number";
}

/** The hour as a person reads it off a clock. */
function clock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * What the cell is, said in words.
 *
 * Deliberately not the visible label: that is a mark for the eye ("+") or a
 * value that only means something in a column ("You"), and neither says what the
 * cell is to somebody who cannot see where it sits.
 */
function spoken(state: string, label: string): string {
  switch (state) {
    case "mine":
      return "booked by you — tap to give it back";
    case "taken":
      return label ? `taken by ${label}` : "taken";
    case "blocked":
      return "not available";
    default:
      return "free — tap to book";
  }
}

/**
 * How a cell is drawn.
 *
 * `striped` is the calendar saying its rows are ruled, which changes exactly
 * one thing: a free hour stops painting its own background and lets the band
 * through, so the stripe reaches across the row instead of stopping at every
 * cell. The states that are filled stay filled — what a person needs at a
 * glance is free from not-free, and that contrast is the filling, not the
 * colour.
 */
function cellColors(
  state: string,
  striped: boolean,
): {
  background: string;
  color: string;
  border: string;
  borderStyle: "solid" | "dashed";
} {
  switch (state) {
    case "mine":
      return {
        background: "var(--hkp-accent, hsl(var(--primary)))",
        color: "hsl(var(--primary-foreground))",
        border: "var(--hkp-accent, hsl(var(--primary)))",
        borderStyle: "solid",
      };
    case "taken":
      return {
        background: "hsl(var(--muted))",
        color: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        borderStyle: "solid",
      };
    case "blocked":
      // The one state drawn as an outline: an hour that exists but is not being
      // offered. Dashed and faded so it plainly recedes behind the hours that
      // are — the distinction a person actually needs is free from not-free, and
      // it has to survive a glance.
      return {
        background: "transparent",
        color: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        borderStyle: "dashed",
      };
    default:
      // Free: a control, and drawn like one. It is the only thing on the
      // calendar a person is being invited to do something with.
      return {
        background: striped ? "transparent" : "hsl(var(--card))",
        color: "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        borderStyle: "solid",
      };
  }
}

function Slot({
  cell,
  height,
  striped,
  onPick,
}: {
  cell: Cell | undefined;
  height: number;
  striped: boolean;
  onPick: (cell: Cell) => void;
}) {
  const [hover, setHover] = useState(false);
  const state = cell?.state ?? "blocked";
  const tappable = !!cell && TAPPABLE.has(state);
  const colors = cellColors(state, striped);
  const label =
    cell?.label === undefined || cell.label === null || cell.label === ""
      ? (DEFAULT_LABEL[state] ?? "")
      : String(cell.label);

  return (
    <button
      type="button"
      disabled={!tappable}
      aria-label={cell ? `${clock(cell.hour)}, ${spoken(state, label)}` : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (cell && tappable) {
          onPick(cell);
        }
      }}
      style={{
        height,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6px",
        borderRadius: 5,
        borderWidth: 1,
        borderStyle: colors.borderStyle,
        borderColor:
          tappable && hover
            ? "var(--hkp-accent, hsl(var(--primary)))"
            : colors.border,
        // Over a band, hovering keeps the cell clear and answers with the ring
        // below instead: filling it would hide the stripe, and fill it with the
        // colour that means taken.
        backgroundColor:
          tappable && hover && state === "free" && !striped
            ? "hsl(var(--muted))"
            : colors.background,
        color: colors.color,
        cursor: tappable ? "pointer" : "default",
        // A free hour that cannot be taken is still an hour: it keeps its place
        // in the column and simply stops offering itself.
        opacity: state === "blocked" ? 0.45 : 1,
        fontSize: state === "free" && label === "+" ? 13 : 11,
        fontWeight: state === "mine" ? 600 : 400,
        lineHeight: 1.2,
        overflow: "hidden",
        transition: "border-color 0.12s, box-shadow 0.12s",
        boxShadow:
          tappable && hover
            ? "inset 0 0 0 1px var(--hkp-accent, hsl(var(--primary)))"
            : "none",
      }}
    >
      {/* Its own block, so a label too long for the column is truncated at the
          end rather than clipped at both — a centred flex item has no width of
          its own to run out of. The full value stays available on hover. */}
      <span
        title={label || undefined}
        style={{
          display: "block",
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function CalendarRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<CalendarWidget>) {
  const rows = useNotificationValue(boardContext, widget.source);
  const { run, prompt } = useWidgetActions(boardContext);

  const cells = useMemo(
    () => (Array.isArray(rows) ? rows.filter(isCell) : []),
    [rows],
  );

  const { hours, columnCount } = useMemo(() => {
    if (!cells.length) {
      return { hours: [] as number[], columnCount: 0 };
    }
    const mentioned = cells.map((c) => c.hour);
    const from = widget.fromHour ?? Math.min(...mentioned);
    const to = widget.toHour ?? Math.max(...mentioned);
    const span: number[] = [];
    for (let hour = from; hour <= to; hour += 1) {
      span.push(hour);
    }
    const widest = Math.max(...cells.map((c) => c.column));
    return {
      hours: span,
      columnCount: Math.max(widget.columns?.length ?? 0, widest),
    };
  }, [cells, widget.fromHour, widget.toHour, widget.columns]);

  // One lookup for the whole grid rather than a scan per cell.
  const byPosition = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
      map.set(`${cell.hour}:${cell.column}`, cell);
    }
    return map;
  }, [cells]);

  // Everything a tap sends is read against the cell tapped, the question
  // included — which is how one cell asks and the next goes straight through.
  const pick = (cell: Cell) => {
    void run({
      action: widget.action
        ? {
            serviceUuid: widget.action.serviceUuid,
            configure: interpolateTemplate(
              widget.action.configure,
              cell,
            ) as Record<string, unknown>,
          }
        : undefined,
      actions: widget.actions
        ? (interpolateTemplate(widget.actions, cell) as typeof widget.actions)
        : undefined,
      confirm: widget.confirm
        ? String(interpolateTemplate(widget.confirm, cell) ?? "")
        : undefined,
    });
  };

  if (!hours.length || !columnCount) {
    return (
      <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
        Nothing to show yet.
      </div>
    );
  }

  const rowHeight = widget.rowHeight ?? 34;
  const stripe = widget.stripe;
  const dayField = widget.dayField ?? "day";
  const day = dayField ? cells[0]?.[dayField] : undefined;
  const headings = Array.from(
    { length: columnCount },
    (_unused, i) => widget.columns?.[i] ?? String(i + 1),
  );
  // The gutter is a fixed column so the hours stay put while the rest shares
  // what is left evenly — a column that grew with its content would put a
  // different hour under every heading.
  const template = `52px repeat(${columnCount}, minmax(64px, 1fr))`;

  return (
    <>
      {day !== undefined && day !== null && day !== "" ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "hsl(var(--foreground))",
            marginBottom: 8,
          }}
        >
          {String(day)}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 52 + columnCount * 64 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: template,
              gap: 4,
              paddingBottom: 6,
              borderBottom: "1px solid hsl(var(--border))",
              marginBottom: 6,
            }}
          >
            <div />
            {headings.map((heading) => (
              <div
                key={heading}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "center",
                  color: "hsl(var(--muted-foreground))",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {heading}
              </div>
            ))}
          </div>

          {/* Striped, the bands have to touch, so the space between two hours
              moves inside them: the gap becomes padding, which leaves the
              geometry exactly as it was and the colour unbroken. Only the
              vertical half of it — room at the sides would shift the cells out
              from under the headings. */}
          <div style={{ display: "grid", gap: stripe ? 0 : ROW_GAP }}>
            {hours.map((hour, row) => (
              <div
                key={hour}
                style={{
                  display: "grid",
                  gridTemplateColumns: template,
                  gap: ROW_GAP,
                  alignItems: "center",
                  ...(stripe
                    ? {
                        background: row % 2 === 0 ? stripe.even : stripe.odd,
                        paddingTop: ROW_GAP / 2,
                        paddingBottom: ROW_GAP / 2,
                      }
                    : {}),
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    // Digits in a column have to line up, or the axis reads as
                    // ragged text rather than a scale.
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    paddingRight: 6,
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {clock(hour)}
                </div>
                {headings.map((_heading, i) => (
                  <Slot
                    key={i}
                    cell={byPosition.get(`${hour}:${i + 1}`)}
                    height={rowHeight}
                    striped={!!stripe}
                    onPick={pick}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {prompt}
    </>
  );
}
