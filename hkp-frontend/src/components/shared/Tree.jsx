import React, { Component } from "react";
import { List, Breadcrumb } from "semantic-ui-react";

import { t } from "../../styles";

export class Tree extends Component {
  renderFile = (file, selected, onChange) => {
    const { path } = this.props;
    const absoluteFn = path.concat(file.name).join("/");
    const isSelected = absoluteFn === selected;
    const spacing = { padding: "1px 2px" };
    return (
      <List.Item
        key={absoluteFn}
        style={{ cursor: "pointer" }}
        onClick={(ev) => onChange(ev, { selected: absoluteFn })}
      >
        <List.Icon name="file" style={spacing} />
        <List.Content>
          <List.Header
            style={{
              backgroundColor: isSelected && "#4183c4",
              ...spacing,
            }}
          >
            <span style={{ color: isSelected && "white" }}>{file.name}</span>
          </List.Header>
          {/*
            <List.Description style={spacing}>
              no description available
            </List.Description>
          */}
        </List.Content>
      </List.Item>
    );
  };

  renderFolder = (folder, selected, onChange) => (
    <List.Item
      key={folder.name}
      style={{ cursor: "pointer" }}
      onClick={() => this.props.onExpand(folder)}
    >
      <List.Icon name="folder" />
      <List.Content>
        <List.Header>{folder.name}</List.Header>
        {/*<List.Description>no description available</List.Description>*/}
      </List.Content>
    </List.Item>
  );

  renderItems = (items, selected, onChange) => (
    <List>
      {items.map((item) =>
        item.type === "file"
          ? this.renderFile(item, selected, onChange)
          : this.renderFolder(item, selected, onChange)
      )}
    </List>
  );

  renderBreadcrumbs = () => {
    const { path = [], onPath } = this.props;

    return (
      <Breadcrumb>
        <Breadcrumb.Section style={t.m(3, 0)} link onClick={() => onPath(null)}>
          /
        </Breadcrumb.Section>
        {path.map((part) => (
          <span key={`tree-breadcrumb-${part}`}>
            <Breadcrumb.Section link onClick={() => onPath(part)}>
              {part}
            </Breadcrumb.Section>
            {part !== "/" && <Breadcrumb.Divider />}
          </span>
        ))}
      </Breadcrumb>
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
