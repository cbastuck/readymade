import { useState, useRef, DragEvent, TouchEvent, MouseEvent } from "react";

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

export default function XYPadUI(props: ServiceUIProps) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [dragging, setDragging] = useState(false);
  const [gridRows, setGridRows] = useState(0);
  const [gridCols, setGridCols] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lastPosRef = useRef<Point>({ x: initialX, y: initialY });
  const padRectRef = useRef<Rect | null>(null);
  const pickOffsetRef = useRef<Point | null>(null);
  const touchDownRef = useRef<Point | undefined>(undefined);

  const update = (newState: any) => {
    if (needsUpdate(newState.gridRows, gridRows)) {
      setGridRows(newState.gridRows);
    }
    if (needsUpdate(newState.gridCols, gridCols)) {
      setGridCols(newState.gridCols);
    }
  };

  const onInit = (initialState: any) => {
    update(initialState);
  };

  const onNotification = async (notification: any) => {
    update(notification);
  };

  const getRelativePosition = (e: any): Point => {
    const { clientX, clientY } = e.targetTouches ? e.targetTouches[0] || {} : e;
    return {
      x: Math.min(
        Math.max(0, clientX - padRectRef.current!.x),
        Number(padRectRef.current!.width!)
      ),
      y: Math.min(
        Math.max(0, clientY - padRectRef.current!.y),
        Number(padRectRef.current!.height!)
      ),
    };
  };

  const updateService = (
    service: ServiceInstance,
    clickPos: Point,
    eventType?: string
  ) => {
    const padWidth = Number(padRectRef.current!.width);
    const padHeight = Number(padRectRef.current!.height);
    const normalizedClickPos = {
      x: Math.min(clickPos.x / padWidth, padWidth),
      y: Math.min(clickPos.y / padHeight, padHeight),
    };

    const cfg: any = {
      position: normalizedClickPos,
      eventType,
    };

    if (gridRows > 0) {
      const heightBtwLines = 1 / gridRows;
      cfg.position.row = Math.floor(normalizedClickPos.y / heightBtwLines);
    }
    if (gridCols > 0) {
      const widthBtwLines = 1 / gridCols;
      cfg.position.column = Math.floor(normalizedClickPos.x / widthBtwLines);
    }
    service.configure(cfg);
  };

  const jumpDraggerToEvent = (e: MouseEvent) => {
    const clickPos = getRelativePosition(e);
    const draggerPos = {
      x: clickPos.x - dragger.width / 2,
      y: clickPos.y - dragger.height / 2,
    };
    setX(draggerPos.x);
    setY(draggerPos.y);
    return clickPos;
  };

  const onTouchContainerStart = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    const clickPos = jumpDraggerToEvent(e);
    updateService(props.service, clickPos, "start");
    touchDownRef.current = clickPos;
  };

  const onTouchContainerEnd = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchDownRef.current) {
      updateService(props.service, touchDownRef.current, "stop");
      touchDownRef.current = undefined;
    }
    setDragging(false);
  };

  const onPanStart = (e: any) => {
    const { clientX, clientY } = e.type.includes("drag")
      ? e
      : e.targetTouches[0];

    if (e.type.includes("drag")) {
      e.dataTransfer.setData("application/hkp-service-xypad", "");
    }

    const elemtRect = e.target.getBoundingClientRect();
    pickOffsetRef.current = {
      x: clientX - elemtRect.left,
      y: clientY - elemtRect.top,
    };
    setDragging(true);
  };

  const onDragEnd = (_ev: any) => {
    if (!touchDownRef.current) {
      //can't not use this.onMouseUp(ev); as the drop pos from _ev seems in a different coordintate system than I expected
      const dropPos = {
        x: x + dragger.width / 2,
        y: y + dragger.width / 2,
      };
      updateService(props.service, dropPos, "stop");
      setDragging(false);
    }
  };

  const onPanEnd = (e: DragEvent) => {
    const dropPos = getRelativePosition(e);

    setDragging(false);
    setX(dropPos.x - (pickOffsetRef.current?.x || 0));
    setY(dropPos.y - (pickOffsetRef.current?.y || 0));
    pickOffsetRef.current = null;
    e.preventDefault();
  };

  const onPan = (e: DragEvent | TouchEvent, service: ServiceInstance) => {
    const touchPos = getRelativePosition(e);
    if (
      (touchPos.x !== lastPosRef.current.x || touchPos.y !== lastPosRef.current.y) &&
      touchPos.x <= Number(padRectRef.current!.width!) &&
      touchPos.y <= Number(padRectRef.current!.height!)
    ) {
      updateService(service, touchPos, "move");
      lastPosRef.current = touchPos;
    }
    e.preventDefault();
    return touchPos;
  };

  const onDblClick = (e: MouseEvent, service: ServiceInstance) => {
    const clickPos = jumpDraggerToEvent(e);
    updateService(service, clickPos);
  };

  const onMouseDown = (ev: MouseEvent) => {
    if (!touchDownRef.current) {
      const clickPos = jumpDraggerToEvent(ev);
      updateService(props.service, clickPos, "start");
    }
  };

  const onMouseUp = (ev: MouseEvent) => {
    const clickPos = jumpDraggerToEvent(ev);
    updateService(props.service, clickPos, "stop");
  };

  const renderMain = () => {
    const { service } = props;

    return (
      <div
        ref={(elem) => {
          if (elem) {
            padRectRef.current = elem.getBoundingClientRect();
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
        onDoubleClick={(ev) => onDblClick(ev, service)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/hkp-service-xypad")) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            onPan(e, service);
          }
        }}
        onDrop={onPanEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchContainerStart}
        onTouchEnd={onTouchContainerEnd}
        onTouchMove={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const pos = onPan(e, service);
          setX(pos.x);
          setY(pos.y);
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
          onTouchStart={onPanStart}
          onTouchMove={(e) => onPan(e, service)}
          onTouchEnd={onDragEnd}
          onDragStart={onPanStart}
          onDragEnd={onDragEnd}
        />
      </div>
    );
  };

  const renderFullscreen = () => {
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
          onClick={() => setIsFullscreen(false)}
        >
          x
        </Button>
        {renderMain()}
      </div>
    );
  };

  const customMenuEntries = [
    {
      name: "Fullscreen",
      icon: <MenuIcon icon={Fullscreen} />,
      disabled: isFullscreen,
      onClick: () => setIsFullscreen(true),
    },
  ];

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
      initialSize={{ width: initialSize.width, height: initialSize.height }}
    >
      {isFullscreen ? renderFullscreen() : renderMain()}
    </ServiceUI>
  );
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
