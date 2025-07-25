import { CSSProperties } from "react";

import TextComp from "hkp-frontend/src/ui-components/Text";

type ParagraphProps = {
  children: any;
  brief: string;
  headline: string;
};

export function Paragraph({ children, brief, headline }: ParagraphProps) {
  return (
    <div style={{ margin: "20px 0px" }}>
      {headline && <h3> {headline}</h3>}
      {brief}
      <TextComp className="ml-[20px]">{children}</TextComp>
    </div>
  );
}

type SectionProps = {
  children: string | string[];
  title: string;
};

export function Section({ title, children }: SectionProps) {
  const headlineStyle: CSSProperties = {
    fontSize: "20px",
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
  return <TextComp style={style}>{children}</TextComp>;
}
