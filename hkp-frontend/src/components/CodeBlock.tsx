import { useState } from "react";

import Code from "./Code";
import CodeBlockHeader from "./CodeBlockHeader";

type Props = {
  children: JSX.Element | JSX.Element[];
  title: string;
};

export default function CodeBlock({ children, title }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen) {
    return (
      <button
        style={{
          backgroundColor: "white",
          border: "none",
          cursor: "pointer",
          color: "#4183c4",
          padding: 0,
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          border: "solid 1px #afafaf",
          borderRadius: "5px",
          margin: 50,
          position: "relative",
          height: "80%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CodeBlockHeader title={title} setIsOpen={setIsOpen} />
        <div style={{ padding: "0px 10px", overflowY: "auto", height: "100" }}>
          <Code>{children}</Code>
        </div>
      </div>
    </div>
  );
}
