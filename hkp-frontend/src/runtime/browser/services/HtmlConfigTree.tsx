import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Tree } from "react-arborist";

import HtmlConfigTreeNode from "./HtmlConfigTreeNode";
import Button from "hkp-frontend/src/ui-components/Button";

type TreeNode = {
  html: string;
  children: TreeConfig;
};

export type TreeConfig = Array<TreeNode>;

type Props = {
  data: TreeConfig;
  onChange: (data: TreeConfig) => void;
};

export default function HtmlConfigTree({ data, onChange }: Props) {
  const onCreate = (node: any) => {
    console.log("Create node", node);
    return { id: "new-id" };
  };
  const onRename = ({ id, name }: any) =>
    onChange(updateNodeContent(data, id, name));

  const onMove = () => {
    console.log("Move node");
  };

  const onDelete = () => {
    console.log("Delete node");
  };

  const onAddRootRow = () => {
    onChange(data.concat({ html: "", children: [] }));
  };

  const treeData = useMemo(() => convertData(data), [data]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <div
        style={{
          display: "flex",
          borderBottom: "solid 1px lightgray",
          margin: 0,
          padding: "3px",
        }}
      >
        <Button
          className="ml-auto"
          size="xs"
          icon={<Plus />}
          onClick={onAddRootRow}
        />
      </div>
      <div style={{ padding: "5px" }}>
        <Tree
          width="100%"
          height={230}
          data={treeData}
          onCreate={onCreate}
          onMove={onMove}
          onRename={onRename}
          onDelete={onDelete}
        >
          {HtmlConfigTreeNode}
        </Tree>
      </div>
    </div>
  );
}

function convertData(config: TreeConfig, parentId = ""): Array<any> {
  return config.map((elem, idx) => {
    const id = parentId ? `${parentId}.${idx}` : `${idx}`;
    return {
      id,
      name: elem.html,
      children: elem.children ? convertData(elem.children, id) : [],
    };
  });
}

function updateNodeContent(
  data: TreeConfig,
  nodeId: string,
  content: string
): TreeConfig {
  const path = nodeId.split(".");
  const cur = Number(path[0]);
  if (path.length === 1) {
    const elem = data[cur];
    return [
      ...data.slice(0, cur),
      { ...elem, html: content },
      ...data.slice(cur + 1),
    ];
  }

  const elem = data[cur];
  return [
    ...data.slice(0, cur),
    {
      ...elem,
      children: updateNodeContent(
        elem.children,
        path.slice(1).join("."),
        content
      ),
    },
    ...data.slice(cur + 1),
  ];
}
