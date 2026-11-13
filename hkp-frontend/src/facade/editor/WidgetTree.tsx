import { ReactNode, useState } from "react";
import { Link2 } from "lucide-react";

import { widgetBindings } from "../bindings";
import { FacadeDescriptor, LayoutItem } from "../types";
import {
  EditorPath,
  EditorSelection,
  nodeLabel,
  nodeIsContainer,
  nodeChildren,
  selectionKey,
} from "./editorUtils";

function samePath(a: EditorPath, b: EditorPath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** One row of the tree, with a fold toggle where it has children. */
function TreeRow({
  depth,
  label,
  selected,
  onSelect,
  expanded,
  onToggle,
  binds,
  className,
}: {
  depth: number;
  label: ReactNode;
  selected: boolean;
  onSelect: () => void;
  // Absent for a row with nothing under it.
  expanded?: boolean;
  onToggle?: () => void;
  // Whether the node reaches anything — a service or facade state — said with
  // the same mark its badge carries on the facade.
  binds?: boolean;
  className?: string;
}) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expanded}
      className={`hkp-editor-tree-row${className ? ` ${className}` : ""}`}
      onClick={onSelect}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <span
        className="hkp-editor-tree-toggle"
        onClick={
          onToggle
            ? (e) => {
                e.stopPropagation();
                onToggle();
              }
            : undefined
        }
      >
        {expanded === undefined ? "" : expanded ? "▾" : "▸"}
      </span>
      <span className="hkp-editor-tree-label">{label}</span>
      {binds && (
        <Link2
          size={10}
          className="hkp-editor-tree-binds"
          aria-label="binds to the board or facade state"
        />
      )}
    </div>
  );
}

function TreeNode({
  item,
  path,
  depth,
  selected,
  onSelect,
}: {
  item: LayoutItem;
  path: EditorPath;
  depth: number;
  selected: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}) {
  const isContainer = nodeIsContainer(item);
  const [expanded, setExpanded] = useState(true);
  const isSelected = selected.kind === "node" && samePath(path, selected.path);

  return (
    <div>
      <TreeRow
        depth={depth}
        label={nodeLabel(item)}
        selected={isSelected}
        onSelect={() => onSelect({ kind: "node", path })}
        expanded={isContainer ? expanded : undefined}
        onToggle={isContainer ? () => setExpanded((v) => !v) : undefined}
        binds={widgetBindings(item).length > 0}
      />
      {isContainer && expanded && (
        <div role="group">
          {nodeChildren(item).map((child, i) => (
            <TreeNode
              key={i}
              item={child}
              path={[...path, i]}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelItem({
  facade,
  index,
  selected,
  onSelect,
}: {
  facade: FacadeDescriptor;
  index: number;
  selected: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
}) {
  const panel = facade.panels[index];
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <TreeRow
        depth={1}
        label={`panel  ·  ${panel.title ?? panel.id}`}
        selected={selected.kind === "panel" && selected.index === index}
        onSelect={() => onSelect({ kind: "panel", index })}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <div role="group">
          <TreeNode
            item={panel.layout}
            path={[index]}
            depth={2}
            selected={selected}
            onSelect={onSelect}
          />
        </div>
      )}
    </div>
  );
}

type Props = {
  facade: FacadeDescriptor;
  selected: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
};

/**
 * Everything the editor can show, as a tree: the facade's panels with their
 * layouts, its state, and what it does by itself — the actions it runs when
 * it opens and the updates it raises as notices.
 */
export function WidgetTree({ facade, selected, onSelect }: Props) {
  const [panelsOpen, setPanelsOpen] = useState(true);
  const key = selectionKey(selected);
  return (
    <div className="hkp-editor-tree" role="tree" aria-label="Facade">
      <TreeRow
        depth={0}
        label="Panels"
        className="hkp-editor-tree-root"
        selected={key === "panels"}
        onSelect={() => onSelect({ kind: "panels" })}
        expanded={panelsOpen}
        onToggle={() => setPanelsOpen((v) => !v)}
      />
      {panelsOpen && (
        <div role="group">
          {facade.panels.map((panel, index) => (
            <PanelItem
              key={panel.id}
              facade={facade}
              index={index}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      <TreeRow
        depth={0}
        label="State"
        className="hkp-editor-tree-root"
        selected={key === "state"}
        onSelect={() => onSelect({ kind: "state" })}
      />
      <TreeRow
        depth={0}
        label="Actions and Updates"
        className="hkp-editor-tree-root"
        selected={key === "actions"}
        onSelect={() => onSelect({ kind: "actions" })}
      />
    </div>
  );
}
