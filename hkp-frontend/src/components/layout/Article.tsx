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
}: Props) {
  return (
    <Template slug={slug} parent="Blog" isRoot={false} width={width}>
      {date && <div style={{ width: "100%", textAlign: "right" }}>{date}</div>}
      <div style={{ marginTop: "10px" }}>
        <Title title={title} image={hero} caption={caption || ""} />
        {children}
      </div>
    </Template>
  );
}
