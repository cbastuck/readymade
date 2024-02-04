import { CSSProperties } from "react";
import { s, t } from "../../styles";

export default function Disclaimer() {
  const p: CSSProperties = {
    marginBottom: 3,
    letterSpacing: 2,
    lineHeight: 1.8,
  };
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={s(t.nc)}>
        <p style={p}>
          Following examples show a fraction of the possibilities. All of them
          run in a Sandbox, intended for building flows that run mostly locally
          and do not require a login. More is possible when mixing remote and
          local runtimes on the same board. Visit the{" "}
          <a href="/playground">playground</a> to explore advanced features.
        </p>
      </div>
    </div>
  );
}
