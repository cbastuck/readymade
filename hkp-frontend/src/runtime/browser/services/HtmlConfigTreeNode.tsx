import { NodeRendererProps } from "react-arborist";
import { Button } from "semantic-ui-react";

export default function Node({
  node,
  style,
  dragHandle,
  tree,
}: NodeRendererProps<any>) {
  const iconColor = node.data.iconColor;
  const isSelected = node.state.isSelected;
  const isLeaf = node.isLeaf;
  const isEditing = node.isEditing;
  return (
    <div
      style={{
        ...style,

        whiteSpace: "nowrap",
        display: "flex",
      }}
      ref={dragHandle}
    >
      <div
        style={{
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: "13px",
        }}
        //onClick={() => node.isInternal && node.toggle()}
        onClick={() => node.edit()}
      >
        <span className="node-text">
          {isEditing ? (
            <input
              type="text"
              defaultValue={node.data.name}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => node.reset()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  node.reset();
                }
                if (e.key === "Enter") {
                  node.submit(e.currentTarget.value);
                }
              }}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
              }}
              autoFocus
            />
          ) : (
            <span>{node.data.name}</span>
          )}
        </span>
      </div>

      <Button
        onClick={() => {
          tree.create({
            parentId: node.id,
          });
        }}
        icon="plus"
        className="hkp-button-borderless"
        style={{ width: "min-content", height: "25px" }}
        size="tiny"
        compact
      />

      <Button
        onClick={() => {
          tree.delete({
            id: node.id,
          });
        }}
        icon="minus"
        className="hkp-button-borderless"
        style={{ width: "min-content", height: "25px" }}
        size="tiny"
        compact
      />
    </div>
  );
}
