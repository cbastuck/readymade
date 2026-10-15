import { useEffect, useState } from "react";

export const BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT = 112;
export const BOARD_ASSIST_MIN_PROMPT_HEIGHT = 72;
export const BOARD_ASSIST_MAX_PROMPT_HEIGHT = 360;
export const BOARD_ASSIST_PROMPT_HEIGHT_KEY = "hkp-board-assist-prompt-height";

export function clampBoardAssistPromptHeight(
  height: number,
  maximum = BOARD_ASSIST_MAX_PROMPT_HEIGHT,
): number {
  const requested = Number.isFinite(height)
    ? height
    : BOARD_ASSIST_DEFAULT_PROMPT_HEIGHT;
  return Math.round(
    Math.max(
      BOARD_ASSIST_MIN_PROMPT_HEIGHT,
      Math.min(BOARD_ASSIST_MAX_PROMPT_HEIGHT, maximum, requested),
    ),
  );
}

export default function BoardAssistPromptResizer({
  height,
  maximumHeightOf,
  onResize,
  onCommit,
  onReset,
}: {
  height: number;
  maximumHeightOf: () => number;
  onResize: (height: number) => void;
  onCommit: (height: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!dragging) return;
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

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const maximum = maximumHeightOf();
    let latest = startHeight;
    setDragging(true);

    const move = (next: PointerEvent) => {
      // The handle is above the prompt: moving it up gives the prompt room.
      latest = clampBoardAssistPromptHeight(
        startHeight + startY - next.clientY,
        maximum,
      );
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
      event.key === "ArrowUp" ? 12 : event.key === "ArrowDown" ? -12 : 0;
    if (!step) return;
    event.preventDefault();
    const next = clampBoardAssistPromptHeight(
      height + step,
      maximumHeightOf(),
    );
    onResize(next);
    onCommit(next);
  };

  return (
    <div
      className="hkp-assist-prompt-resizer"
      role="separator"
      aria-label="Resize conversation and prompt"
      aria-orientation="horizontal"
      aria-valuemin={BOARD_ASSIST_MIN_PROMPT_HEIGHT}
      aria-valuemax={BOARD_ASSIST_MAX_PROMPT_HEIGHT}
      aria-valuenow={height}
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
