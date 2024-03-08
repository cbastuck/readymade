import { CSSProperties } from "react";

type ParagraphProps = {
  children: string | string[];
  brief: string;
  headline: string;
};

export function Paragraph({ children, brief, headline }: ParagraphProps) {
  const headlineStyle: CSSProperties = {
    fontSize: 12,
  };
  return (
    <div style={{ margin: "20px 0px" }}>
      {headline && <h1 style={headlineStyle}> {headline}</h1>}
      {brief}
      <div style={{ marginLeft: 20 }}>{children}</div>
    </div>
  );
}

type SectionProps = {
  children: string | string[];
  title: string;
};

export function Section({ title, children }: SectionProps) {
  const headlineStyle: CSSProperties = {
    fontSize: 16,
  };
  return (
    <>
      <h1 style={headlineStyle}> {title}</h1>
      {children}
    </>
  );
}

type ListItemProps = {
  children: string | string[];
};

export function ListItem({ children }: ListItemProps) {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ width: 40 }}>-</div>
      <div> {children} </div>
    </div>
  );
}

type TextProps = {
  children: string | string[];
};

export function Text({ children }: TextProps) {
  const style: CSSProperties = {
    textTransform: "none",
    fontSize: 16,
  };
  return (
    <div className="hkp-fnt-family" style={style}>
      {children}{" "}
    </div>
  );
}
