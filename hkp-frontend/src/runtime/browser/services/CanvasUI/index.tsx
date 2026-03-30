import { useState, useRef, useEffect, MouseEvent } from "react";
import ResizeObserver from "resize-observer-polyfill";

import { zLayers } from "../../../../styles";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import {
  ServiceAction,
  ServiceInstance,
  ServiceUIProps,
} from "hkp-frontend/src/types";
import { Rect, Size } from "hkp-frontend/src/common";
import { BinaryIcon, ToggleLeft, ToggleRight } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { update, DrawContext } from "./canvasDraw";

export default function CanvasUI(props: ServiceUIProps) {
  const [fullWidth, setFullWidth] = useState<number>(document.body.clientWidth);
  const [fullHeight, setFullHeight] = useState<number>(
    document.body.clientHeight,
  );
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [clearOnRedraw, setClearOnRedraw] = useState<boolean>(true);
  const [canvasWidth, setCanvasWidth] = useState<number>(400);
  const [canvasHeight, setCanvasHeight] = useState<number>(250);
  const [resizable, setResizable] = useState<boolean>(true);
  const [capture, setCapture] = useState<boolean>(false);

  const imageCacheRef = useRef<{ [key: string]: any }>({});
  const clickHandlersRef = useRef<{
    [key: string]: { rect: Rect; action: ServiceAction };
  }>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recentDataRef = useRef<any>(undefined);

  // Use refs for state values needed in async callbacks
  const clearOnRedrawRef = useRef<boolean>(true);
  const fullWidthRef = useRef<number>(document.body.clientWidth);
  const fullHeightRef = useRef<number>(document.body.clientHeight);
  const fullscreenRef = useRef<boolean>(false);
  const canvasWidthRef = useRef<number>(400);
  const canvasHeightRef = useRef<number>(250);
  const captureRef = useRef<boolean>(false);

  useEffect(() => {
    clearOnRedrawRef.current = clearOnRedraw;
  }, [clearOnRedraw]);
  useEffect(() => {
    fullWidthRef.current = fullWidth;
  }, [fullWidth]);
  useEffect(() => {
    fullHeightRef.current = fullHeight;
  }, [fullHeight]);
  useEffect(() => {
    fullscreenRef.current = fullscreen;
  }, [fullscreen]);
  useEffect(() => {
    canvasWidthRef.current = canvasWidth;
  }, [canvasWidth]);
  useEffect(() => {
    canvasHeightRef.current = canvasHeight;
  }, [canvasHeight]);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  useEffect(() => {
    const resizeBodyObserver = new ResizeObserver(onResizeBodyEvent);
    resizeBodyObserver.observe(document.body);
    return () => {
      resizeBodyObserver.disconnect();
    };
  }, []);

  const onResizeBodyEvent = (entries: ResizeObserverEntry[]) => {
    const entry = entries && entries[0];
    if (entry) {
      const newFullWidth = document.body.clientWidth;
      const newFullHeight = document.body.clientHeight;
      setFullWidth(newFullWidth);
      setFullHeight(newFullHeight);
      fullWidthRef.current = newFullWidth;
      fullHeightRef.current = newFullHeight;
      triggerUpdate(recentDataRef.current || {});
    }
  };

  const registerClickHandler = (
    rect: { x: number; y: number; width: number; height: number },
    action: any,
  ) => {
    const id = `${rect.x}${rect.y}`;
    clickHandlersRef.current[id] = { rect: rect as Rect, action };
  };

  const triggerUpdate = (objectOrArray: any) => {
    recentDataRef.current = objectOrArray;
    if (!canvasRef.current) {
      return;
    }
    // Clear click handlers before each redraw so stale handlers don't accumulate
    clickHandlersRef.current = {};
    update(
      canvasRef.current,
      objectOrArray,
      clearOnRedrawRef.current,
      imageCacheRef.current,
      registerClickHandler,
    );
  };

  const onClick = (service: ServiceInstance, ev: MouseEvent) => {
    const { clientX: x, clientY: y } = ev;
    for (const id in clickHandlersRef.current) {
      const { rect, action } = clickHandlersRef.current[id];
      if (
        x >= rect.x &&
        x <= rect.x + (Number(rect.width) || 0) &&
        y >= rect.y &&
        y <= rect.y + (Number(rect.height) || 0)
      ) {
        return invokeClickAction(service, action);
      }
    }
  };

  const invokeClickAction = (service: ServiceInstance, action: any) => {
    if (action.internal) {
      // internal dispatch event
      service.app.next(service, action.internal);
    } else {
      // external action
      service.app.sendAction(action);
    }
  };

  const renderMain = (service: ServiceInstance) => {
    const fullscreenVal = fullscreen || service.fullscreen;
    const w = fullscreenVal ? fullWidth : canvasWidth;
    const h = fullscreenVal ? fullHeight : canvasHeight - 4; // TODO: could not figure out why we grows otherwise
    return (
      <canvas
        ref={(ref) => (canvasRef.current = ref)}
        style={{
          position: fullscreenVal ? "fixed" : undefined,
          top: fullscreenVal ? 0 : undefined,
          left: fullscreenVal ? 0 : undefined,
          zIndex: fullscreenVal ? zLayers.foreground : undefined,
          width: w,
          height: h,
        }}
        onDoubleClick={() => {
          if (resizable && !service.noToggleFullscreenOnDblClick) {
            const toggled = !fullscreenVal;
            service.fullscreen = toggled;
            setFullscreen(toggled);
            fullscreenRef.current = toggled;
            triggerUpdate(recentDataRef.current);
          }
        }}
        onClick={(ev) => onClick(service, ev)}
        width={w}
        height={h}
      />
    );
  };

  const onNotification = (notification: any) => {
    const { render, size, capture: newCapture } = notification;
    if (size !== undefined) {
      const [newCanvasWidth, newCanvasHeight] = size;
      setCanvasWidth(newCanvasWidth);
      setCanvasHeight(newCanvasHeight);
      canvasWidthRef.current = newCanvasWidth;
      canvasHeightRef.current = newCanvasHeight;
      triggerUpdate(recentDataRef.current);
    }

    if (newCapture !== undefined) {
      setCapture(newCapture);
      captureRef.current = newCapture;
    }
    if (render) {
      const { captureMime, frameID } = notification;
      triggerUpdate(render);
      if (captureMime && canvasRef.current) {
        canvasRef.current.toBlob(
          (blob) =>
            props.service.configure({
              capturedFrame: {
                frameID,
                blob,
              },
            }),
          captureMime,
        );
      }
    }
  };

  const onInit = (initialState: any) => {
    const {
      size,
      resizable: newResizable,
      fullscreen: newFullscreen,
      clearOnRedraw: newClearOnRedraw = true,
    } = initialState;

    setClearOnRedraw(newClearOnRedraw);
    clearOnRedrawRef.current = newClearOnRedraw;
    setResizable(!!newResizable);
    if (newFullscreen !== undefined) {
      setFullscreen(newFullscreen);
      fullscreenRef.current = newFullscreen;
    }
    if (size) {
      setCanvasWidth(size[0]);
      setCanvasHeight(size[1]);
      canvasWidthRef.current = size[0];
      canvasHeightRef.current = size[1];
    }
  };

  const onResize = (service: ServiceInstance, { width, height }: Size) => {
    service.configure({ size: [width, height] });
  };

  const { service } = props;

  const onCopyDataURL = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      navigator.clipboard.writeText(dataUrl);
    }
  };

  const onToggleOutputImage = () =>
    service.configure({ capture: !captureRef.current });
  const customMenuEntries = [
    {
      name: "Copy Data URL",
      icon: <MenuIcon icon={BinaryIcon} />,
      onClick: onCopyDataURL,
    },
    {
      name: `Output Blob ${capture ? "[is on]" : "[is off]"}`,
      icon: (
        <MenuIcon
          icon={capture ? ToggleRight : ToggleLeft}
          className={capture ? "stroke-sky-600" : ""}
        />
      ),
      onClick: onToggleOutputImage,
    },
  ];
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      onResize={onResize}
      resizable={resizable}
      customMenuEntries={customMenuEntries}
    >
      <div
        style={{
          overflow: "hidden",
          padding: resizable ? 5 : 0,
          margin: 0,
        }}
      >
        {renderMain(service)}
      </div>
    </ServiceUI>
  );
}
