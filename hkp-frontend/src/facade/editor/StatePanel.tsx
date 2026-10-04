import { useFacadeState } from "../FacadeStateContext";
import { PropValue } from "./EditableRow";

/**
 * What the facade's state holds right now.
 *
 * Facade state is how one widget reaches another — a selection published under
 * a key, read elsewhere as { "$state": "<key>" } — and it exists only while the
 * facade is on screen, so nothing in the board document shows it. Read here
 * from the same store the widgets write to, it follows them as they are used.
 * A key whose value was given up stays listed, with nothing beside it.
 */
export function StatePanel() {
  const { state } = useFacadeState();
  const entries = Object.entries(state);

  return (
    <div
      aria-label="Facade state"
      role="region"
      style={{
        flexShrink: 0,
        maxHeight: "40%",
        overflowY: "auto",
        borderTop: "1px solid hsl(var(--border))",
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "hsl(var(--muted-foreground))",
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 12,
        }}
      >
        state
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            color: "hsl(var(--muted-foreground))",
            fontSize: 12,
            fontFamily: "monospace",
            opacity: 0.5,
          }}
        >
          Nothing in facade state yet.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key} style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <td
                  style={{
                    padding: "5px 12px 5px 0",
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "hsl(var(--muted-foreground))",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                    width: "40%",
                  }}
                >
                  {key}
                </td>
                <td
                  style={{
                    padding: "5px 0",
                    fontSize: 11,
                    fontFamily: "monospace",
                    verticalAlign: "top",
                  }}
                >
                  <PropValue value={value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
