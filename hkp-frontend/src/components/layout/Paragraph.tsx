import { ReactNode } from "react";

type Props = {
  headline?: string;
  children: ReactNode;
};

export default function Paragraph({ headline, children }: Props) {
  return (
    <>
      {headline && <h2>{headline}</h2>}
      <div style={{ margin: "10px 0px" }}>{children}</div>
    </>
  );
}
