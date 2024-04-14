import { ReactElement } from "react";

type Props = {
  current: number;
  children: ReactElement[];
};

export default function OneOfVisible({ current, children }: Props) {
  const visibleStyle = { opacity: 1, transition: "opacity 0.7s" };
  const invisibleStyle = {
    opacity: 0,
    transition: "opacity 0.7s",
    pointerEvents: "none",
  };
  return (
    <div className={`relative w-full h-full overflow-hidden`}>
      {children.map((child, idx) => (
        <div
          key={`one-of-visible-${idx}`}
          className="absolute top-0 left-0 w-full h-full"
          style={current === idx ? visibleStyle : invisibleStyle}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
