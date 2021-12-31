import React, { Component } from "react";
import ServiceUI from "./ServiceUI";

const serviceName = "XY Pad";
const serviceId = "hookup.to/service/xy-pad";

const transparentImage = new Image();
transparentImage.src =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

class XYPadUI extends Component {
  state = {
    x: 0,
    y: 0,
  };

  onInit = (initialState) => {};

  onNotification = async (service, notification) => {};

  onPanStart = (e) => {
    e.dataTransfer.setDragImage(transparentImage, 0, 0);
    const { clientX, clientY } = e.type.includes("drag")
      ? e
      : e.targetTouches[0];

    const pickRect = e.target.getBoundingClientRect();
    const pickOffset = {
      x: clientX - pickRect.left,
      y: clientY - pickRect.top,
    };

    const rect = this.elem.getBoundingClientRect();
    this.parentOffset = { x: rect.x + pickOffset.x, y: rect.y + pickOffset.y };
    this.parentSize = { width: rect.width, height: rect.height };
  };

  onPanEnd = () => {};

  getPan = (e) => {
    const { clientX, clientY } = e.type.includes("drag")
      ? e
      : e.targetTouches[0];
    return {
      x: clientX - this.parentOffset.x,
      y: clientY - this.parentOffset.y,
    };
  };

  onPan = (e, service) => {
    if (e.clientX <= 0 || e.clientY <= 0) {
      return false;
    }
    const pan = this.getPan(e);
    this.setState(pan);
    service.configure({
      position: {
        x: pan.x / this.parentSize.width,
        y: pan.y / this.parentSize.height,
      },
    });
  };

  renderMain = (service) => {
    const { x, y } = this.state;
    return (
      <div
        ref={(elem) => (this.elem = elem)}
        style={{ width: 300, height: 300, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            width: 50,
            height: 50,
            top: y,
            left: x,
            backgroundColor: "lightgray",
            border: "solid 1px gray",
            borderRadius: "50%",
            cursor: "move",
          }}
          draggable={true}
          onTouchStart={this.onPanStart}
          onDragStart={this.onPanStart}
          onDrag={(e) => this.onPan(e, service)}
          onTouchMove={this.onPan}
          onTouchEnd={this.onPanEnd}
          onDragEnd={this.onPanEnd}
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}

class XYPad {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { position } = config;
    if (position !== undefined) {
      this.app.next(this, position);
    }
  }

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new XYPad(app, board, descriptor, id),
  createUI: XYPadUI,
};

export default descriptor;
