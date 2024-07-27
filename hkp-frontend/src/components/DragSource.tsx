import { CSSProperties } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  children: JSX.Element | JSX.Element[];
  value?: any;
  type: string;
};
export default function DragSource({
  className,
  type,
  value,
  children,
  style = {},
}: Props) {
  return (
    <div
      className={className}
      style={style}
      draggable={true}
      onDragStart={(ev) => ev.dataTransfer.setData(type, JSON.stringify(value))}
    >
      {children}
    </div>
  );
}
