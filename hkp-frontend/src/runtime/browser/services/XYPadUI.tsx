import { Component, DragEvent, TouchEvent, MouseEvent } from "react";

import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";
import { Point, Rect } from "@/common";

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

export default class XYPadUI extends Component<ServiceUIProps> {
  state = {
    x: initialX,
    y: initialY,
    dragging: false,
  };

  lastPos = {
    x: initialX,
    y: initialY,
  };

  padRect: Rect | null = null;
  pickOffset: Point | null = null;

  touchDown: Point | undefined;

  onInit = (_initialState: any) => {};

  onNotification = async (_notification: any) => {};

  getRelativePosition = (e: any): Point => {
    const { clientX, clientY } = e.targetTouches ? e.targetTouches[0] : e;
    return {
      x: Math.min(
        Math.max(0, clientX - this.padRect!.x),
        Number(this.padRect!.width!)
      ),
      y: Math.min(
        Math.max(0, clientY - this.padRect!.y),
        Number(this.padRect!.height!)
      ),
    };
  };

  onTouchContainerStart = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    const clickPos = this.jumpDraggerToEvent(e);
    this.updateService(this.props.service, clickPos, "start");
    this.touchDown = clickPos;
  };

  onTouchContainerEnd = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.touchDown) {
      this.updateService(this.props.service, this.touchDown, "stop");
      this.touchDown = undefined;
    }
  };

  onPanStart = (e: any) => {
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

  onPanEnd = (e: DragEvent) => {
    const dropPos = this.getRelativePosition(e);

    this.setState({
      dragging: false,
      x: dropPos.x - (this.pickOffset?.x || 0),
      y: dropPos.y - (this.pickOffset?.y || 0),
    });
    this.pickOffset = null;
    e.preventDefault();
  };

  onPan = (e: DragEvent | TouchEvent, service: ServiceInstance) => {
    const touchPos = this.getRelativePosition(e);
    if (
      (touchPos.x !== this.lastPos.x || touchPos.y !== this.lastPos.y) &&
      touchPos.x <= Number(this.padRect!.width!) &&
      touchPos.y <= Number(this.padRect!.height!)
    ) {
      this.updateService(service, touchPos);
      this.lastPos = touchPos;
    }
    e.preventDefault();
    return false;
  };

  jumpDraggerToEvent = (e: MouseEvent) => {
    const clickPos = this.getRelativePosition(e);
    const draggerPos = {
      x: clickPos.x - dragger.width / 2,
      y: clickPos.y - dragger.height / 2,
    };
    this.setState(draggerPos);
    return clickPos;
  };

  onDblClick = (e: MouseEvent, service: ServiceInstance) => {
    const clickPos = this.jumpDraggerToEvent(e);
    this.updateService(service, clickPos);
  };

  onMouseDown = (ev: MouseEvent) => {
    if (!this.touchDown) {
      const clickPos = this.jumpDraggerToEvent(ev);
      this.updateService(this.props.service, clickPos, "start");
    }
  };

  onMouseUp = (ev: MouseEvent) => {
    const clickPos = this.jumpDraggerToEvent(ev);
    this.updateService(this.props.service, clickPos, "stop");
  };

  updateService = (
    service: ServiceInstance,
    clickPos: Point,
    eventType?: string
  ) => {
    const normalizedClickPos = {
      x: Math.min(
        clickPos.x / Number(this.padRect!.width),
        Number(this.padRect!.width)
      ),
      y: Math.min(
        clickPos.y / Number(this.padRect!.height),
        Number(this.padRect!.height)
      ),
    };
    service.configure({
      position: normalizedClickPos,
      eventType,
    });
  };

  renderMain = () => {
    const { service } = this.props;
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
        }}
        onDoubleClick={(ev) => this.onDblClick(ev, service)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onPan(e, service);
        }}
        onDrop={this.onPanEnd}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onTouchStart={this.onTouchContainerStart}
        onTouchEnd={this.onTouchContainerEnd}
      >
        <Raster n={7} />
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
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}

function Raster({ n }: { n: number }) {
  const numLines = n;
  const heightBtwLines = 1 / numLines;
  const lines = new Array(numLines).fill(0).map((_, idx) => {
    const y = (idx + 1) * heightBtwLines;
    return (
      <line x1={-1} y1={y} x2={2} y2={y} stroke="gray" strokeWidth={0.001} />
    );
  });
  return (
    <svg
      style={{
        position: "relative",
        border: "solid 0.1px lightgray",
        height: "100%",
        width: "100%",
      }}
      viewBox="0 0 1 1"
      width="100%"
      height="100%"
    >
      {lines}
    </svg>
  );
}
