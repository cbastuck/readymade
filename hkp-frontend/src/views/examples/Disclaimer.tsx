import { CSSProperties } from "react";
import { s, t } from "../../styles";

export default function Disclaimer() {
  const p: CSSProperties = {
    marginBottom: 3,
    letterSpacing: 2,
    lineHeight: 1.4,
  };
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={s(t.nc)}>
        <p style={p}>
          The examples below showcase just a glimpse of the possibilities. They
          all run in a Sandbox, designed for constructing flows that primarily
          operate locally without the need for a login. The potential expands
          further when combining remote and local runtimes on the same board.
          For a deeper exploration of advanced features, visit the
          <a href="/playground"> Playground</a> to explore advanced features.
        </p>
      </div>
    </div>
  );
}
