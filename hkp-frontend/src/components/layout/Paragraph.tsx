import { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;

  width?: string;
  headline?: string;
  style?: CSSProperties;
  headlineFontSize?: string;
};

export default function Paragraph({
  width,
  headline,
  children,
  style,
  headlineFontSize,
}: Props) {
  return (
    <div
      style={{
        width: width || undefined,
        margin: width ? "auto" : undefined,
        ...style,
      }}
    >
      {headline && (
        <h2 style={{ fontSize: headlineFontSize || undefined }}>{headline}</h2>
      )}
      <div style={{ margin: "10px 0px" }}>{children}</div>
    </div>
  );
}
