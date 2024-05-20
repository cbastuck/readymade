import { Component } from "react";
import { Save, Folder } from "lucide-react";

import { t } from "../../styles";

type OnChange = (ev: any, data: { selected: string }) => void;

type Props = {
  values: any;
  path: any;
  selected: any;
  onChange: OnChange;
  onExpand: (folder: any) => void;
  onPath: (p: any) => void;
};

export class Tree extends Component<Props> {
  renderFile = (file: any, selected: any, onChange: OnChange) => {
    const { path } = this.props;
    const absoluteFn = path.concat(file.name).join("/");
    const isSelected = absoluteFn === selected;
    const spacing = { padding: "1px 2px" };
    return (
      <div
        key={absoluteFn}
        style={{ cursor: "pointer" }}
        className="flex gap-1"
        onClick={(ev) => onChange(ev, { selected: absoluteFn })}
      >
        <Save />
        <div>
          <div
            style={{
              backgroundColor: isSelected ? "#4183c4" : undefined,
              ...spacing,
            }}
          >
            <span style={{ color: isSelected ? "white" : "" }}>
              {file.name}
            </span>
          </div>
        </div>
      </div>
    );
  };

  renderFolder = (folder: any, _selected: any, _onChange: OnChange) => (
    <div
      key={folder.name}
      className="flex gap-1"
      style={{ cursor: "pointer" }}
      onClick={() => this.props.onExpand(folder)}
    >
      <Folder />
      <div>
        <div>{folder.name}</div>
        {/*<List.Description>no description available</List.Description>*/}
      </div>
    </div>
  );

  renderItems = (items: any, selected: any, onChange: OnChange) => (
    <div className="flex flex-col">
      {items.map((item: any) =>
        item.type === "file"
          ? this.renderFile(item, selected, onChange)
          : this.renderFolder(item, selected, onChange)
      )}
    </div>
  );

  renderBreadcrumbs = () => {
    const { path = [], onPath } = this.props;
    return (
      <div className="flex border-b mb-2">
        <div style={t.m(3, 0)} onClick={() => onPath(null)}>
          /
        </div>
        {path.map((part: any) => (
          <div key={`tree-breadcrumb-${part}`}>
            <div onClick={() => onPath(part)}>{part}</div>
          </div>
        ))}
      </div>
    );
  };

  render() {
    const { values: files, selected, onChange } = this.props;
    return (
      <div
        style={{
          border: "solid 1px lightgray",
          borderRadius: 5,
          padding: 5,
          overflow: "auto",
          maxHeight: 200,
        }}
      >
        {this.renderBreadcrumbs()}
        {this.renderItems(files, selected, onChange)}
      </div>
    );
  }
}

export default Tree;
