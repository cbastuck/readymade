import { useState } from "react";
import { FacadeDescriptor, LayoutItem } from "../types";
import { EditorPath, nodeLabel, nodeIsContainer, nodeChildren } from "./editorUtils";

type TreeNodeProps = {
  item: LayoutItem;
  path: EditorPath;
  selectedPath: EditorPath;
  onSelect: (path: EditorPath) => void;
};

function TreeNode({ item, path, selectedPath, onSelect }: TreeNodeProps) {
  const isContainer = nodeIsContainer(item);
  const children = nodeChildren(item);
  const [expanded, setExpanded] = useState(true);

  const isSelected =
    path.length === selectedPath.length &&
    path.every((v, i) => v === selectedPath[i]);

  const depth = path.length - 1; // root node (path=[panelIdx]) is depth 0

  return (
    <div>
      <div
        onClick={() => onSelect(path)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8 + depth * 14,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
          cursor: "pointer",
          background: isSelected
            ? "hsl(var(--accent))"
            : "transparent",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "monospace",
          color: isSelected
            ? "hsl(var(--accent-foreground))"
            : "hsl(var(--muted-foreground))",
          userSelect: "none",
        }}
      >
        {isContainer ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            style={{ opacity: 0.6, width: 10, flexShrink: 0, textAlign: "center" }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nodeLabel(item)}
        </span>
      </div>

      {isContainer && expanded && (
        <div>
          {children.map((child, i) => (
            <TreeNode
              key={i}
              item={child}
              path={[...path, i]}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  facade: FacadeDescriptor;
  selectedPath: EditorPath;
  onSelect: (path: EditorPath) => void;
};

export function WidgetTree({ facade, selectedPath, onSelect }: Props) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid hsl(var(--border))",
        overflowY: "auto",
        padding: "8px 4px",
      }}
    >
      {facade.panels.map((panel, panelIdx) => (
        <div key={panel.id}>
          {facade.panels.length > 1 && (
            <div
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "hsl(var(--muted-foreground))",
                opacity: 0.5,
                padding: "4px 8px 2px",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {panel.title ?? panel.id}
            </div>
          )}
          <TreeNode
            item={panel.layout}
            path={[panelIdx]}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}
