import { s, t } from "../../styles";

export default function Disclaimer() {
  const p = { marginBottom: 3 };
  return (
    <div style={{ marginBottom: 30 }}>
      <div
        style={s(
          t.nc,
          t.fs15,
          { color: "#555", backgroundColor: "rgba(172, 200, 229, 0.01)" },
          { padding: 0, lineHeight: 1.5, letterSpacing: 1 }
        )}
      >
        <p style={p}>
          Following examples show a fraction of the possibilities. All of them
          run in a Sandbox, intended for building flows that run mostly locally
          and do not require a login. More is possible when mixing remote and
          local runtimes on the same board. But registration and login aren't
          public yet. Instead play with multiple local runtimes on{" "}
          <a href="/playground">playground</a>. Use the public{" "}
          <span style={s(t.bold, t.it)}>reflector</span> to hookup different
          playgrounds or connect to <span style={s(t.bold, t.it)}>peers</span>.
          More on both topics soon.
        </p>
      </div>
    </div>
  );
}
