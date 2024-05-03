import React, { Component } from "react";

export default class DropZone extends Component {
  state = {
    dragZoneOpen: false,
  };

  isFilesDrag = (ev) => ev.dataTransfer.types.indexOf("Files") !== -1;
  isItemsDrag = (ev) => ev.dataTransfer.types.length && !this.isFilesDrag(ev);

  isDragAccepted = (ev) => {
    const { onFiles = false, onItems = false } = this.props;
    if (onFiles && this.isFilesDrag(ev)) {
      return true;
    }

    if (onItems && this.isItemsDrag(ev)) {
      return true;
    }

    return false;
  };

  onDragOver = (ev) => {
    if (this.isDragAccepted(ev)) {
      this.setState({ dragZoneOpen: true });
    }
    ev.preventDefault();
  };

  onDragLeave = (ev) => {
    this.setState({ dragZoneOpen: false });
  };

  onDrop = (ev) => {
    const { onFiles = false, onItems = false } = this.props;
    const data = ev.dataTransfer;

    if (this.isDragAccepted(ev)) {
      if (this.isFilesDrag(ev)) {
        onFiles(data.files);
      }

      if (this.isItemsDrag(ev)) {
        const items = Array.from(data.items).map(({ type }) => ({
          type,
          data: data.getData(type),
        }));
        onItems(items);
      }
    }

    this.setState({ dragZoneOpen: false });
    ev.preventDefault();
  };

  render() {
    const { label, style } = this.props;
    return (
      <div
        className="flex items-center"
        style={{
          ...style,
          border: "solid 1px lightgray",
          borderRadius: 5,
          backgroundColor: this.state.dragZoneOpen ? "lightgreen" : "#4183c4",
          color: "white",
          textAlign: "center",
        }}
        onDragOver={this.onDragOver}
        onDrop={this.onDrop}
        onDragLeave={this.onDragLeave}
      >
        {label}
      </div>
    );
  }
}
