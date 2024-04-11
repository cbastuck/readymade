import { ReactNode } from "react";
import Template from "../../views/Template";
import Title from "./Title";

type Props = {
  width?: string;
  slug?: string;
  title: string;
  hero?: string;
  caption?: string;
  date?: string;
  withTemplate?: boolean;
  children: ReactNode | ReactNode[];
};

export default function Article({
  width,
  slug,
  title,
  hero,
  children,
  caption,
  date,
  withTemplate = true,
}: Props) {
  const content = (
    <>
      {date && (
        <div
          className="font-sans text-sm"
          style={{ width: "100%", textAlign: "right" }}
        >
          {date}
        </div>
      )}
      <div style={{ marginTop: "10px" }}>
        <Title title={title} image={hero} caption={caption || ""} />
        {children}
      </div>
    </>
  );
  return withTemplate ? (
    <Template slug={slug} parent="Blog" isRoot={false} width={width}>
      {content}
    </Template>
  ) : (
    <div style={{ width, margin: "auto", textAlign: "left" }}>{content}</div>
  );
}
