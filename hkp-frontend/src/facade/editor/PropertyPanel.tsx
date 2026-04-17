import { LayoutItem } from "../types";
import { EditableRow } from "./EditableRow";

type Props = {
  node: LayoutItem | null;
  onChange: (updated: LayoutItem) => void;
};

export function PropertyPanel({ node, onChange }: Props) {
  if (!node) {
    return (
      <div
        style={{
          padding: 24,
          color: "hsl(var(--muted-foreground))",
          fontSize: 12,
          fontFamily: "monospace",
          opacity: 0.5,
        }}
      >
        Select a node in the tree to inspect its properties.
      </div>
    );
  }

  const entries = Object.entries(node).filter(([key]) => key !== "items");

  const handleCommit = (key: string, newValue: unknown) => {
    onChange({ ...node, [key]: newValue } as LayoutItem);
  };

  return (
    <div style={{ padding: 16 }}>
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
        {(node as any).type ?? "container"}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {entries.map(([key, value]) => (
            <EditableRow
              key={key}
              propKey={key}
              value={value}
              onCommit={handleCommit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
