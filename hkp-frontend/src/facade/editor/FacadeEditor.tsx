import { useState } from "react";
import { FacadeDescriptor, LayoutItem } from "../types";
import { EditorPath, getAtPath, setAtPath } from "./editorUtils";
import { WidgetTree } from "./WidgetTree";
import { PropertyPanel } from "./PropertyPanel";

type Props = {
  facade: FacadeDescriptor;
  onChange: (updated: FacadeDescriptor) => void;
};

export function FacadeEditor({ facade, onChange }: Props) {
  const [selectedPath, setSelectedPath] = useState<EditorPath>([]);

  const selectedNode = getAtPath(facade, selectedPath);

  const handleNodeChange = (updated: LayoutItem) => {
    onChange(setAtPath(facade, selectedPath, updated));
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <WidgetTree
        facade={facade}
        selectedPath={selectedPath}
        onSelect={setSelectedPath}
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PropertyPanel node={selectedNode} onChange={handleNodeChange} />
      </div>
    </div>
  );
}
