import React, { Component } from 'react';

export default class DropZone extends Component {
  state = {
    dragZoneOpen: false,
  };

  isFilesDrag = ev => ev.dataTransfer.types.indexOf("Files") !== -1;
  isItemsDrag = ev => ev.dataTransfer.types.indexOf("Items") !== -1;

  isDragAccepted = ev => {
    const { onFiles=false, onItems=false } = this.props;
    if (onFiles && this.isFilesDrag(ev)) {
      return true;
    }

    if (onItems && this.isItemsDrag(ev)) {
      return true;
    }

    return false;
  }

  onDragOver = ev => {
    if (this.isDragAccepted(ev)) {
      this.setState({ dragZoneOpen: true })
    }
    ev.preventDefault();
  }

  onDragLeave = ev => {
    this.setState({ dragZoneOpen: false });
  }

  onDrop = ev => {
    const { onFiles=false, onItems=false } = this.props;
    const data = ev.dataTransfer;

    if (this.isDragAccepted(ev)) {
      if (this.isFilesDrag(ev)) {
        onFiles(data.files);
      }

      if (this.isItemsDrag(ev)) {
        onItems(data.items);
      }
    }
  
    this.setState({ dragZoneOpen: false });
    ev.preventDefault();    
  }

  render() {
    const { label } = this.props;
    return (
      <div
        style={{
          height: 80,
          paddingTop: 30,
          border: 'solid 1px lightgray',
          borderRadius: 5,
          backgroundColor: this.state.dragZoneOpen ? 'lightgreen' : '#4183c4',
          color: 'white',
          fontSize: 20,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 'bold'
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