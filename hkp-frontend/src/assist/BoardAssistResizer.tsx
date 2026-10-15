import { useEffect, useState } from "react";

export const BOARD_ASSIST_DEFAULT_WIDTH = 390;
export const BOARD_ASSIST_MIN_WIDTH = 300;
export const BOARD_ASSIST_WIDTH_KEY = "hkp-board-assist-width";

const BOARD_ASSIST_MAX_WIDTH = 800;
const MIN_BOARD_WIDTH = 320;

export function clampBoardAssistWidth(width: number): number {
  const requested = Number.isFinite(width)
    ? width
    : BOARD_ASSIST_DEFAULT_WIDTH;
  const available = Math.max(
    BOARD_ASSIST_MIN_WIDTH,
    window.innerWidth - MIN_BOARD_WIDTH,
  );
  return Math.round(
    Math.max(
      BOARD_ASSIST_MIN_WIDTH,
      Math.min(BOARD_ASSIST_MAX_WIDTH, available, requested),
    ),
  );
}

export default function BoardAssistResizer({
  width,
  onResize,
  onCommit,
  onReset,
}: {
  width: number;
  onResize: (width: number) => void;
  onCommit: (width: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const { style } = document.body;
    const cursor = style.cursor;
    const select = style.userSelect;
    style.cursor = "ew-resize";
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
    let latest = startWidth;
    setDragging(true);

    const move = (next: PointerEvent) => {
      // The handle is on the left: moving it left gives the panel more room.
      latest = clampBoardAssistWidth(startWidth + startX - next.clientX);
      onResize(latest);
    };
    const stop = () => {
      setDragging(false);
      onCommit(latest);
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
      event.key === "ArrowLeft" ? 12 : event.key === "ArrowRight" ? -12 : 0;
    if (!step) return;
    event.preventDefault();
    const next = clampBoardAssistWidth(width + step);
    onResize(next);
    onCommit(next);
  };

  return (
    <div
      className="hkp-assist-resizer"
      role="separator"
      aria-label="Resize Board Assist"
      aria-orientation="vertical"
      aria-valuemin={BOARD_ASSIST_MIN_WIDTH}
      aria-valuemax={clampBoardAssistWidth(BOARD_ASSIST_MAX_WIDTH)}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      title="Drag to resize — double-click to reset"
      data-active={dragging || hovered ? "true" : undefined}
    />
  );
}
