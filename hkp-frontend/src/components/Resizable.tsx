import { Size } from "hkp-frontend/src/common";
import { ReactElement, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  children: ReactElement;
  hideHandle?: boolean;
  initialSize?: Size;
  onResize?: (newSize: Size) => void;
};

export default function Resizable({
  children,
  hideHandle,
  disabled,
  initialSize: initialSizeProp,
  onResize,
}: Props) {
  const initialSize = useRef<Size | null>(initialSizeProp || null);
  const [size, setSize] = useState<Size>(
    initialSize?.current || { width: undefined, height: undefined }
  );
  const [_, setResizing] = useState(false);

  const ref = useRef<HTMLDivElement | null>(null);
  const currentSize = useRef<Size>({ width: undefined, height: undefined });

  const onMouseDown = () => {
    setResizing(true);
    if (initialSize.current === null && ref.current) {
      initialSize.current = ref.current.getBoundingClientRect();
    }

    const mouseMoveHandler = (ev: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const newX = ev.clientX - rect.x;
        const newY = ev.clientY - rect.y;

        const newWidth = Math.max(Number(initialSize.current!.width), newX);
        const newHeight = Math.max(
          Number(initialSize.current!.height ?? rect.height),
          newY
        );

        if (
          newWidth !== currentSize.current.width ||
          newHeight !== currentSize.current.height
        ) {
          currentSize.current = { width: newWidth, height: newHeight };

          // initial size is treated as minimum size, if it was undefined on purpose
          // set the current size as the initial size
          if (
            initialSize.current?.height === undefined ||
            initialSize.current?.width === undefined
          ) {
            initialSize.current = {
              width: initialSize.current?.width ?? newWidth,
              height: initialSize.current?.height ?? newHeight,
            };
          }
          setSize(currentSize.current);
          if (onResize) {
            onResize(currentSize.current);
          }
        }
      }
    };
    const mouseUpHandler = () => {
      setResizing(false);
      document.removeEventListener("mouseup", mouseUpHandler);
      document.removeEventListener("mousemove", mouseMoveHandler);
    };
    document.addEventListener("mouseup", mouseUpHandler);
    document.addEventListener("mousemove", mouseMoveHandler);
  };
  if (disabled) {
    return children;
  }

  return (
    <div ref={ref} className="h-full w-full overflow-y-auto" style={size}>
      {children}
      {!hideHandle && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
          }}
          onMouseDown={onMouseDown}
        >
          <svg viewBox="0 0 10 10">
            <polygon
              points="0,10, 10,0, 10,10"
              style={{
                fill: "#9f9f9f",
                stroke: "transparent",
                strokeWidth: "1",
              }}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
