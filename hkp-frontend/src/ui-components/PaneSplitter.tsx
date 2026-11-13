import { useEffect, useState } from "react";

/**
 * A drag handle between two vertically stacked panes. Reports the height the
 * pointer implies for the pane it resizes — the one above it, or the one below
 * — clamped to what the caller allows; persisting it is the caller's business.
 *
 * Shared by the sidebar (runtimes over services) and the facade editor (tree,
 * selected element, state).
 */
export default function PaneSplitter({
  label,
  resizes = "above",
  onResize,
  onCommit,
  onReset,
  heightOf,
  minHeight,
  maxHeight,
  className,
}: {
  /** What the handle is called to assistive technology. */
  label: string;
  /** Which pane the height belongs to. */
  resizes?: "above" | "below";
  onResize: (height: number) => void;
  onCommit: () => void;
  onReset: () => void;
  /** The pane's height right now — a drag starts from what is on screen. */
  heightOf: () => number;
  /** Enough of the pane to be worth having; below this the drag stops. */
  minHeight: number;
  /** As far as the pane may grow, read when it is dragged. */
  maxHeight: () => number;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // While dragging, the whole document shows the resize cursor and stops
  // selecting text — the pointer regularly leaves the handle itself.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const { style } = document.body;
    const cursor = style.cursor;
    const select = style.userSelect;
    style.cursor = "ns-resize";
    style.userSelect = "none";
    return () => {
      style.cursor = cursor;
      style.userSelect = select;
    };
  }, [dragging]);

  const clamp = (height: number) =>
    Math.max(minHeight, Math.min(Math.max(minHeight, maxHeight()), height));

  // Dragging down grows the pane above and shrinks the one below.
  const sign = resizes === "above" ? 1 : -1;

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = heightOf();
    setDragging(true);

    const move = (e: PointerEvent) => {
      onResize(clamp(startHeight + sign * (e.clientY - startY)));
    };
    const stop = () => {
      setDragging(false);
      onCommit();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowUp" ? -12 : event.key === "ArrowDown" ? 12 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    onResize(clamp(heightOf() + sign * step));
    onCommit();
  };

  const lit = dragging || hovered;
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      tabIndex={0}
      className={className}
      onPointerDown={startDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      title="Drag to resize — double-click to reset"
      style={{
        height: 7,
        flexShrink: 0,
        cursor: "ns-resize",
        userSelect: "none",
        // The hairline lights up on hover / while dragging; the hit area
        // around it stays invisible.
        background: `linear-gradient(180deg, transparent 3px, ${
          lit ? "var(--hkp-accent)" : "var(--border-mid, #d1d5db)"
        } 3px, ${
          lit ? "var(--hkp-accent)" : "var(--border-mid, #d1d5db)"
        } 4px, transparent 4px)`,
      }}
    />
  );
}
