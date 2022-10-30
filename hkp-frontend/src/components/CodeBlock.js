import { useState } from "react";

import Code from "./Code";

export default function CodeBlock({ children, title }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen) {
    return (
      <button
        style={{
          backgroundColor: "white",
          border: "none",
          cursor: "pointer",
          fontFamily: "roboto",
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
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          border: "solid 1px #afafaf",
          borderRadius: "5px",
          margin: 50,
          position: "relative",
          overflowY: "auto",
          height: "80%",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            position: "sticky",
            top: 0,
            right: 0,
            backgroundColor: "white",
            borderBottom: "solid 1px #efefef",
          }}
        >
          <div
            style={{
              width: "100%",
              textAlign: "center",
              padding: 5,
              fontWeight: "bold",
            }}
          >
            {title}
          </div>
          <button
            style={{
              marginLeft: "auto",
              padding: "2px 12px",
              backgroundColor: "#efefef",
              borderRadius: 5,
              border: "solid 1px transparent",
              color: "gray",
            }}
            onClick={() => setIsOpen(false)}
          >
            X
          </button>
        </div>

        <div style={{ padding: "0px 10px" }}>
          <Code>{children}</Code>
        </div>
      </div>
    </div>
  );
}
