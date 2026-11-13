import { LayoutItem } from "../types";
import { EditableRow, ValueKind } from "./EditableRow";

const OPTIONAL_PROPERTIES: Record<string, Record<string, ValueKind>> = {
  text: {
    color: "string",
    tone: "string",
    fontSize: "number",
    lineHeight: "number",
    mono: "boolean",
    wrap: "boolean",
    href: "string",
  },
  repeat: {
    stripe: "json",
    gap: "number",
  },
};

type Props<T extends object> = {
  node: T | null;
  onChange: (updated: T) => void;
  // Fields shown elsewhere in the editor — a panel's layout, the facade's
  // panels — and so not listed here. They are kept as they are on a change.
  omit?: string[];
};

/**
 * The fields of what is selected, each editable in place: a layout node, a
 * panel, or the facade itself.
 */
export function PropertyPanel<T extends object = LayoutItem>({
  node,
  onChange,
  omit = [],
}: Props<T>) {
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

  const nodeType = (node as any).type ?? "container";
  const optionalForType = OPTIONAL_PROPERTIES[nodeType] ?? {};
  const hidden = new Set(["items", "template", ...omit]);
  const existingEntries = Object.entries(node).filter(
    ([key]) => !hidden.has(key),
  );
  const existingKeys = new Set(existingEntries.map(([key]) => key));
  const entries: Array<[string, unknown, ValueKind | undefined]> = [
    ...existingEntries.map(
      ([key, value]) =>
        [key, value, optionalForType[key]] as [
          string,
          unknown,
          ValueKind | undefined,
        ],
    ),
    ...Object.entries(optionalForType)
      .filter(([key]) => !existingKeys.has(key))
      .map(
        ([key, kind]) =>
          [key, undefined, kind] as [string, unknown, ValueKind | undefined],
      ),
  ];

  const handleCommit = (key: string, newValue: unknown) => {
    if (
      newValue === undefined ||
      (newValue === "" && key in optionalForType)
    ) {
      const next = { ...node } as Record<string, unknown>;
      delete next[key];
      onChange(next as T);
      return;
    }
    onChange({ ...node, [key]: newValue } as T);
  };

  return (
    <table className="hkp-editor-props">
        <tbody>
          {entries.map(([key, value, defaultKind]) => (
            <EditableRow
              key={key}
              propKey={key}
              value={value}
              defaultKind={defaultKind}
              onCommit={handleCommit}
            />
          ))}
        </tbody>
    </table>
  );
}
