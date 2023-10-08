import React, { Component } from "react";
import ServiceUI from "./ServiceUI";

const serviceName = "XY Pad";
const serviceId = "hookup.to/service/xy-pad";

const transparentImage = new Image();
transparentImage.src =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

const dragger = {
  width: 50,
  height: 50,
};

const container = {
  width: 300,
  height: 200,
};

const initialX = container.width / 2 - dragger.width / 2;
const initialY = container.height / 2 - dragger.height / 2;
export class XYPadUI extends Component {
  state = {
    x: initialX,
    y: initialY,
    dragging: false,
  };

  lastPos = {
    x: initialX,
    y: initialY,
  };

  onInit = (initialState) => {};

  onNotification = async (service, notification) => {};

  getRelativePosition = (e) => {
    //const { clientX, clientY } = e.type.includes("drag") ? e : e.targetTouches[0];
    const { clientX, clientY } = e.targetTouches ? e.targetTouches[0] : e;
    return {
      x: Math.min(Math.max(0, clientX - this.padRect.x), this.padRect.width),
      y: Math.min(Math.max(0, clientY - this.padRect.y), this.padRect.height),
    };
  };

  onPanStart = (e) => {
    //e.dataTransfer.setDragImage(e.target, 0, 0);
    const { clientX, clientY } = e.type.includes("drag")
      ? e
      : e.targetTouches[0];

    const elemtRect = e.target.getBoundingClientRect();
    this.pickOffset = {
      x: clientX - elemtRect.left,
      y: clientY - elemtRect.top,
    };
    this.setState({ dragging: true });
  };

  onDragEnd = () => {
    this.setState({ dragging: false });
  };

  onPanEnd = (e) => {
    const dropPos = this.getRelativePosition(e);

    this.setState({
      dragging: false,
      x: dropPos.x - this.pickOffset.x,
      y: dropPos.y - this.pickOffset.y,
    });
    this.pickOffset = null;
    e.preventDefault();
  };

  onPan = (e, service) => {
    const touchPos = this.getRelativePosition(e);
    if (
      (touchPos.x !== this.lastPos.x || touchPos.y !== this.lastPos.y) &&
      touchPos.x <= this.padRect.width &&
      touchPos.y <= this.padRect.height
    ) {
      this.updateService(service, touchPos);
      this.lastPos = touchPos;
    }
    e.preventDefault();
    return false;
  };

  onDblClick = (e, service) => {
    const clickPos = this.getRelativePosition(e);
    const draggerPos = {
      x: clickPos.x - dragger.width / 2,
      y: clickPos.y - dragger.height / 2,
    };
    this.setState(draggerPos);
    this.updateService(service, clickPos);
  };

  updateService = (service, clickPos) => {
    const normalizedClickPos = {
      x: Math.min(clickPos.x / this.padRect.width, this.padRect.width),
      y: Math.min(clickPos.y / this.padRect.height, this.padRect.height),
    };
    service.configure({
      position: normalizedClickPos,
    });
  };

  renderMain = (service) => {
    const { x, y, dragging } = this.state;
    return (
      <div
        ref={(elem) => {
          if (elem) {
            this.padRect = elem.getBoundingClientRect();
          }
        }}
        style={{
          width: container.width,
          height: container.height,
          position: "relative",
          overflow: "hidden",
          border: "solid 1px gray",
        }}
        onDoubleClick={(ev) => this.onDblClick(ev, service)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onPan(e, service);
        }}
        onDrop={this.onPanEnd}
      >
        <div
          style={{
            position: "absolute",
            width: dragger.width,
            height: dragger.height,
            top: y,
            left: x,
            backgroundColor: "lightgray",
            border: "solid 1px gray",
            borderRadius: "50%",
            cursor: "move",
            opacity: dragging ? 0.1 : 1,
            touchAction: "none",
          }}
          draggable={true}
          onTouchStart={this.onPanStart}
          onTouchMove={(e) => this.onPan(e, service)}
          onTouchEnd={this.onDragEnd}
          onDragStart={this.onPanStart}
          onDragEnd={this.onDragEnd}
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
