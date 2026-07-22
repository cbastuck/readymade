import { useEffect, useState } from "react";

/**
 * Drag handle sitting on a column's right border. Reports the width the
 * pointer implies; clamping and persistence are the caller's business.
 *
 * The parent needs `position: relative`.
 */
export default function ColumnResizer({
  width,
  onResize,
}: {
  /** The column's current width in pixels — the drag starts from it. */
  width: number;
  onResize: (width: number) => void;
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
    style.cursor = "col-resize";
    style.userSelect = "none";
    return () => {
      style.cursor = cursor;
      style.userSelect = select;
    };
  }, [dragging]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    setDragging(true);

    const move = (e: PointerEvent) => {
      onResize(startWidth + e.clientX - startX);
    };
    const stop = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div
      onPointerDown={startDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      title="Drag to resize"
      style={{
        position: "absolute",
        top: 0,
        right: -3,
        width: 7,
        height: "100%",
        cursor: "col-resize",
        zIndex: 2,
        // The hairline lights up on hover / while dragging; the hit area
        // around it stays invisible.
        background:
          dragging || hovered
            ? "linear-gradient(90deg, transparent 3px, var(--st-accent) 3px, var(--st-accent) 4px, transparent 4px)"
            : "none",
      }}
    />
  );
}
