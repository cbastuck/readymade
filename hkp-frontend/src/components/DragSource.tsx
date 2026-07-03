import { CSSProperties, RefObject } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  children: JSX.Element | JSX.Element[];
  value?: any;
  type: string;
  dragImageRef?: RefObject<HTMLElement | null>;
};
export default function DragSource({
  className,
  type,
  value,
  children,
  style = {},
  dragImageRef,
}: Props) {
  return (
    <div
      className={className}
      style={style}
      draggable={true}
      onDragStart={(ev) => {
        ev.dataTransfer.setData(type, JSON.stringify(value));
        const img = dragImageRef?.current;
        // Chromium can't rasterize a GPU-composited <canvas> into a drag image;
        // handing `setDragImage` an element that contains one silently cancels
        // the drag (often without throwing). This is why services embedding a
        // canvas-based UI (e.g. a Monaco editor's minimap) couldn't be dragged.
        // Skip the custom image in that case, and keep try/catch for the rarer
        // case where it throws — either way we fall back to the browser default.
        if (img && !img.querySelector("canvas")) {
          try {
            const rect = img.getBoundingClientRect();
            ev.dataTransfer.setDragImage(
              img,
              ev.clientX - rect.left,
              ev.clientY - rect.top,
            );
          } catch {
            // Ignore — the browser falls back to the default drag image.
          }
        }
      }}
    >
      {children}
    </div>
  );
}
