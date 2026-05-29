import { CSSProperties, RefObject } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  children: JSX.Element | JSX.Element[];
  value?: any;
  type: string;
  dragImageRef?: RefObject<HTMLElement>;
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
        if (dragImageRef?.current) {
          const rect = dragImageRef.current.getBoundingClientRect();
          ev.dataTransfer.setDragImage(
            dragImageRef.current,
            ev.clientX - rect.left,
            ev.clientY - rect.top,
          );
        }
      }}
    >
      {children}
    </div>
  );
}
