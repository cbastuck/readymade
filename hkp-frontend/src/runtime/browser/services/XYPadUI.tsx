import { Component, DragEvent, TouchEvent, MouseEvent } from "react";

import { Fullscreen } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Point, Rect } from "hkp-frontend/src/common";
import Button from "hkp-frontend/src/ui-components/Button";

const transparentImage = new Image();
transparentImage.src =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";

const dragger = {
  width: 40,
  height: 40,
};

const initialSize = {
  width: 320,
  height: 200,
};
const offset = 20;
const initialX = initialSize.width / 2 - dragger.width / 2 - offset;
const initialY = initialSize.height / 2 - dragger.height / 2 - offset;

const FULLSCREENZINDEX = 1000;

export default class XYPadUI extends Component<ServiceUIProps> {
  state = {
    x: initialX,
    y: initialY,
    dragging: false,
    gridRows: 0,
    gridCols: 0,
    isFullscreen: false,
  };

  lastPos = {
    x: initialX,
    y: initialY,
  };

  padRect: Rect | null = null;
  pickOffset: Point | null = null;

  touchDown: Point | undefined;

  update = (newState: any) => {
    if (needsUpdate(newState.gridRows, this.state.gridRows)) {
      this.setState({ gridRows: newState.gridRows });
    }

    if (needsUpdate(newState.gridCols, this.state.gridCols)) {
      this.setState({ gridCols: newState.gridCols });
    }
  };

  onInit = (initialState: any) => {
    this.update(initialState);
  };

  onNotification = async (notification: any) => {
    this.update(notification);
  };

  getRelativePosition = (e: any): Point => {
    const { clientX, clientY } = e.targetTouches ? e.targetTouches[0] || {} : e;
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
    this.setState({ dragging: false });
  };

  onPanStart = (e: any) => {
    const { clientX, clientY } = e.type.includes("drag")
      ? e
      : e.targetTouches[0];

    if (e.type.includes("drag")) {
      e.dataTransfer.setData("application/hkp-service-xypad", "");
    }

    const elemtRect = e.target.getBoundingClientRect();
    this.pickOffset = {
      x: clientX - elemtRect.left,
      y: clientY - elemtRect.top,
    };
    this.setState({ dragging: true });
  };

  onDragEnd = (_ev: any) => {
    if (!this.touchDown) {
      //can't not use this.onMouseUp(ev); as the drop pos from _ev seems in a different coordintate system than I expected
      const dropPos = {
        x: this.state.x + dragger.width / 2,
        y: this.state.y + dragger.width / 2,
      };
      this.updateService(this.props.service, dropPos, "stop");
      this.setState({
        dragging: false,
      });
    }
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
      this.updateService(service, touchPos, "move");
      this.lastPos = touchPos;
    }
    e.preventDefault();
    return touchPos;
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
    const padWidth = Number(this.padRect!.width);
    const padHeight = Number(this.padRect!.height);
    const normalizedClickPos = {
      x: Math.min(clickPos.x / padWidth, padWidth),
      y: Math.min(clickPos.y / padHeight, padHeight),
    };

    const cfg: any = {
      position: normalizedClickPos,
      eventType,
    };

    if (this.state.gridRows > 0) {
      const heightBtwLines = 1 / this.state.gridRows;
      cfg.position.row = Math.floor(normalizedClickPos.y / heightBtwLines);
    }
    if (this.state.gridCols > 0) {
      const widthBtwLines = 1 / this.state.gridCols;
      cfg.position.column = Math.floor(normalizedClickPos.x / widthBtwLines);
    }
    service.configure(cfg);
  };

  renderMain = () => {
    const { service } = this.props;
    const { x, y, dragging, gridRows, gridCols } = this.state;

    return (
      <div
        ref={(elem) => {
          if (elem) {
            this.padRect = elem.getBoundingClientRect();
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          marginBottom: 10,
          position: "relative",
          overflow: "hidden",
          touchAction: "none",
        }}
        onDoubleClick={(ev) => this.onDblClick(ev, service)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/hkp-service-xypad")) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            this.onPan(e, service);
          }
        }}
        onDrop={this.onPanEnd}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onTouchStart={this.onTouchContainerStart}
        onTouchEnd={this.onTouchContainerEnd}
        onTouchMove={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const pos = this.onPan(e, service);
          this.setState(pos);
        }}
      >
        {gridRows > 0 || gridCols > 0 ? (
          <Grid rows={gridRows} cols={gridCols} x={x} y={y} />
        ) : null}
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

  renderFullscreen = () => {
    return (
      <div
        style={{
          position: "fixed",
          width: "100vw",
          height: "90vh",
          left: 0,
          top: 0,
          background: "white",
          zIndex: FULLSCREENZINDEX,
        }}
      >
        <Button
          style={{ zIndex: FULLSCREENZINDEX + 1 }}
          className="absolute top-0 right-0"
          onClick={() => this.setState({ isFullscreen: false })}
        >
          x
        </Button>
        {this.renderMain()}
      </div>
    );
  };

  render() {
    const { isFullscreen } = this.state;
    const customMenuEntries = [
      {
        name: "Fullscreen",
        icon: <MenuIcon icon={Fullscreen} />,
        disabled: isFullscreen,
        onClick: () => this.setState({ isFullscreen: true }),
      },
    ];
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        customMenuEntries={customMenuEntries}
        initialSize={{ width: initialSize.width, height: initialSize.height }}
      >
        {isFullscreen ? this.renderFullscreen() : this.renderMain()}
      </ServiceUI>
    );
  }
}

function Grid({
  rows,
  cols,
  x,
  y,
}: {
  rows: number;
  cols: number;
  x: number;
  y: number;
}) {
  const heightBtwLines = 1 / rows;
  const widthBtwLines = 1 / cols;
  const nRowLines = rows - 1; // do not render the last line, as it comes from he border around the raster
  const nColLines = cols - 1;
  const rowLines =
    nRowLines > 0
      ? new Array(nRowLines).fill(0).map((_, idx) => {
          const y = (idx + 1) * heightBtwLines;
          return <line key={`col-line-${idx}`} x1={0} y1={y} x2={1} y2={y} />;
        })
      : null;
  const colLines =
    nColLines > 0
      ? new Array(nColLines).fill(0).map((_, idx) => {
          const x = (idx + 1) * widthBtwLines;
          return <line key={`row-line-${idx}`} x1={x} y1={0} x2={x} y2={1} />;
        })
      : null;

  return (
    <svg
      preserveAspectRatio="none"
      style={{
        position: "relative",
        border: "solid 0.1px lightgray",
        height: "100%",
        width: "100%",
      }}
      viewBox="0 0 1 1"
      width="100%"
      height="100%"
      stroke="gray"
      strokeWidth={0.001}
    >
      {/* Render invisible circle outside view to avoid glitches during drag*/}
      <circle cx={x + 1} cy={y + 1} r="0.001" />
      {rowLines}
      {colLines}
    </svg>
  );
}
