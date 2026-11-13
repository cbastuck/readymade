import { useState } from "react";
import { Link2 } from "lucide-react";

import { widgetBindings } from "../bindings";
import { FacadeDescriptor, LayoutItem } from "../types";
import { EditorPath, nodeLabel, nodeIsContainer, nodeChildren } from "./editorUtils";

type TreeNodeProps = {
  item: LayoutItem;
  path: EditorPath;
  selectedPath: EditorPath;
  onSelect: (path: EditorPath) => void;
};

function samePath(a: EditorPath, b: EditorPath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function TreeNode({ item, path, selectedPath, onSelect }: TreeNodeProps) {
  const isContainer = nodeIsContainer(item);
  const children = nodeChildren(item);
  const [expanded, setExpanded] = useState(true);
  const isSelected = samePath(path, selectedPath);
  // Whether the node reaches anything — a service or facade state — said with
  // the same mark its badge carries on the facade.
  const binds = widgetBindings(item).length > 0;

  const depth = path.length - 1; // root node (path=[panelIdx]) is depth 0

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        className="hkp-editor-tree-row"
        onClick={() => onSelect(path)}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {isContainer ? (
          <span
            className="hkp-editor-tree-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="hkp-editor-tree-toggle" />
        )}
        <span className="hkp-editor-tree-label">{nodeLabel(item)}</span>
        {binds && (
          <Link2
            size={10}
            className="hkp-editor-tree-binds"
            aria-label="binds to the board or facade state"
          />
        )}
      </div>

      {isContainer && expanded && (
        <div role="group">
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

/**
 * The facade's layout as a tree. Its first row is the facade itself — what it
 * runs when it opens and the notices it raises — selected by the empty path.
 */
export function WidgetTree({ facade, selectedPath, onSelect }: Props) {
  return (
    <div className="hkp-editor-tree" role="tree" aria-label="Facade layout">
      <div
        role="treeitem"
        aria-selected={selectedPath.length === 0}
        className="hkp-editor-tree-row hkp-editor-tree-root"
        onClick={() => onSelect([])}
      >
        <span className="hkp-editor-tree-toggle" />
        <span className="hkp-editor-tree-label">Facade</span>
      </div>
      {facade.panels.map((panel, panelIdx) => (
        <div key={panel.id}>
          {facade.panels.length > 1 && (
            <div className="hkp-editor-section-title hkp-editor-tree-panel">
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
