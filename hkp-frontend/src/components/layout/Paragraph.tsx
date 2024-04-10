import { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;

  width?: string;
  headline?: string;
  style?: CSSProperties;
};

export default function Paragraph({ width, headline, children, style }: Props) {
  return (
    <div
      style={{
        width: width || undefined,
        margin: width ? "auto" : undefined,
        ...style,
      }}
    >
      {headline && <h2>{headline}</h2>}
      <div
        className="font-serif-wet tracking-widest"
        style={{ margin: "20px 0px" }}
      >
        {children}
      </div>
    </div>
  );
}
