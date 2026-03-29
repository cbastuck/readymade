import { useState, useRef, useEffect, MouseEvent } from "react";
import ResizeObserver from "resize-observer-polyfill";

import { createObjectURL, revokeObjectURL } from "./helpers";
import { zLayers } from "../../../styles";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import {
  ServiceAction,
  ServiceInstance,
  ServiceUIProps,
} from "hkp-frontend/src/types";
import { Rect, Size } from "hkp-frontend/src/common";
import { BinaryIcon, ToggleLeft, ToggleRight } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";

const TWO_PI = 2 * Math.PI;

type DrawElement = any;

export default function CanvasUI(props: ServiceUIProps) {
  const [fullWidth, setFullWidth] = useState<number>(document.body.clientWidth);
  const [fullHeight, setFullHeight] = useState<number>(document.body.clientHeight);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [clearOnRedraw, setClearOnRedraw] = useState<boolean>(true);
  const [canvasWidth, setCanvasWidth] = useState<number>(400);
  const [canvasHeight, setCanvasHeight] = useState<number>(250);
  const [resizable, setResizable] = useState<boolean>(true);
  const [capture, setCapture] = useState<boolean>(false);

  const imageCacheRef = useRef<{ [key: string]: any }>({});
  const clickHandlersRef = useRef<{ [key: string]: { rect: Rect; action: ServiceAction } }>({});
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

  useEffect(() => { clearOnRedrawRef.current = clearOnRedraw; }, [clearOnRedraw]);
  useEffect(() => { fullWidthRef.current = fullWidth; }, [fullWidth]);
  useEffect(() => { fullHeightRef.current = fullHeight; }, [fullHeight]);
  useEffect(() => { fullscreenRef.current = fullscreen; }, [fullscreen]);
  useEffect(() => { canvasWidthRef.current = canvasWidth; }, [canvasWidth]);
  useEffect(() => { canvasHeightRef.current = canvasHeight; }, [canvasHeight]);
  useEffect(() => { captureRef.current = capture; }, [capture]);

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
      update(recentDataRef.current || {});
    }
  };

  const getCanvasDim = () => {
    return {
      width: canvasRef.current?.width || 0,
      height: canvasRef.current?.height || 0,
    };
  };

  const getCanvasCenter = () => {
    const { width, height } = getCanvasDim();
    const centerX = width / 2;
    const centerY = height / 2;
    return {
      centerX,
      centerY,
      canvasWidth: width,
      canvasHeight: height,
    };
  };

  const fetchImage = (url: string) => {
    return new Promise((resolve) => {
      const image = imageCacheRef.current[url];
      if (!image) {
        const img = new Image();
        img.onload = () => {
          imageCacheRef.current[url] = img;
          resolve(img);
        };
        img.src = url;
      } else {
        resolve(image);
      }
    });
  };

  const createImage = (blob: Blob | typeof Image) => {
    if (blob instanceof Image) {
      return Promise.resolve(blob); // already an image
    }
    return new Promise((resolve) => {
      const imageUrl = createObjectURL(blob);
      if (imageUrl) {
        const img = new Image();
        img.addEventListener("load", () => {
          revokeObjectURL(imageUrl);
          resolve(img);
        });
        img.src = imageUrl;
      }
    });
  };

  const registerClickHandler = (rect: Rect, action: ServiceAction) => {
    const id = `${rect.x}${rect.y}`;
    clickHandlersRef.current[id] = { rect, action };
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

  const drawExplainer = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const {
      pointer = { x: "50%", y: "50%", length: "1%" },
      text,
      font,
      color,
      textTransform,
      direction = "left-to-right",
    } = data;
    const ltr = direction === "left-to-right";
    const { canvasWidth, canvasHeight } = getCanvasCenter();

    const pointerX = toAbsolute(pointer.x, canvasWidth);
    const pointerY = toAbsolute(pointer.y, canvasHeight);
    const pointerLength = toAbsolute(pointer.length, canvasWidth);

    const strokeDestX = ltr
      ? pointerX + pointerLength
      : pointerX - pointerLength;
    const strokeDestY = ltr
      ? pointerY + pointerLength
      : pointerY - pointerLength;

    ctx.strokeStyle = color || "#ff0000";
    ctx.beginPath();
    ctx.moveTo(pointerX, pointerY);
    ctx.lineTo(strokeDestX, strokeDestY);
    ctx.stroke();

    const l = 100;
    const destX = ltr ? strokeDestX + l : strokeDestX - l;
    const destY = strokeDestY;
    ctx.beginPath();
    ctx.moveTo(strokeDestX, strokeDestY);
    ctx.lineTo(destX, destY);
    ctx.stroke();

    const textData = {
      text,
      font,
      x: destX + 10,
      y: destY - 10,
      textTransform,
      color,
    };
    if (ltr) {
      textData.x -= pointerLength;
    } else {
      textData.x -= pointerLength * 1.5; // TODO: HACK the text width is not taken into consideration
    }
    drawText(ctx, textData);
  };

  const drawImage = async (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const {
      centerX: canvasCenterX,
      centerY: canvasCenterY,
      canvasWidth,
      canvasHeight,
    } = getCanvasCenter();

    const {
      url,
      data: blob,
      opacity,
      height = "100%",
      unscaled,
      onClick: onClickHandler,
      centerX,
      centerY,
      x,
      y,
    } = data;
    const img = (
      url ? await fetchImage(url) : await createImage(blob)
    ) as HTMLImageElement;
    const scaledHeight =
      height === undefined ? canvasHeight : toAbsolute(height, canvasHeight);
    const aspectRatio = img.width / img.height;
    const scaledWidth = scaledHeight * aspectRatio;
    const cx = centerX
      ? toAbsolute(centerX, canvasWidth) - scaledWidth / 2
      : canvasCenterX - scaledWidth / 2;
    const cy = centerY
      ? toAbsolute(centerY, canvasHeight) - scaledHeight / 2
      : canvasCenterY - img.height / 2;

    const imgX = x === undefined ? cx : toAbsolute(x, canvasWidth);
    const imgY = y === undefined ? cy : toAbsolute(y, canvasHeight);
    const rect = {
      x: imgX,
      y: imgY,
      width: unscaled ? img.width : scaledWidth,
      height: unscaled ? img.height : scaledHeight,
    };
    if (onClickHandler) {
      registerClickHandler(rect, onClickHandler);
    }
    ctx.save();
    if (opacity !== undefined) {
      ctx.globalAlpha = opacity;
    }
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  };

  const applyTextTransform = (input: string, operation: string) => {
    switch (operation) {
      case "lowercase":
        return input.toLowerCase();
      case "lowercase-spacing-1":
        return input.toLowerCase().split("").join(" ");
      case "uppercase":
        return input.toUpperCase();
      case "uppercase-spacing-1":
        return input.toUpperCase().split("").join(" ");
      default:
        console.warn(`Unknown transform operation: ${operation}`);
        return input;
    }
  };

  const drawText = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { centerX, centerY, canvasWidth, canvasHeight } =
      getCanvasCenter();
    const {
      font = "30px Arial",
      text,
      x: dx,
      y: dy,
      onClick: onClickHandler,
      contour,
      color,
      textTransform,
    } = data;

    ctx.save();
    ctx.fillStyle = color || "#000";
    ctx.strokeStyle = contour ? contour.color : ctx.fillStyle;
    ctx.lineWidth = contour ? contour.lineWidth : 1;

    const isFontString = typeof font === "string";
    const {
      style = "normal",
      weight = "normal",
      size = "10px",
      family = "Arial",
    } = isFontString ? {} : font;
    const isRelative = size[size.length - 1] === "%";

    if (isFontString) {
      // relative font size not supported in this notation
      ctx.font = font;
    } else {
      // font is an object
      ctx.font = `${style} ${weight} ${isRelative ? "10px" : size} ${family}`;
    }

    const t = textTransform
      ? applyTextTransform(text, textTransform)
      : text;
    let textWidth = ctx.measureText(t).width;
    if (isRelative) {
      const targetRelativeWidth = Number(size.substr(0, size.length - 1)) / 100;
      const currentRelativeWidth = textWidth / canvasWidth;
      const correctionRatio = targetRelativeWidth / currentRelativeWidth;
      const correctedSize = Math.floor(correctionRatio * 10);
      ctx.font = `${style} ${weight} ${correctedSize}px ${family}`;
      textWidth = ctx.measureText(t).width;
    }
    const x =
      dx === undefined ? centerX - textWidth / 2 : toAbsolute(dx, canvasWidth);
    const y = dy === undefined ? centerY : toAbsolute(dy, canvasHeight);
    ctx.fillText(t, x, y);
    // ctx.strokeText(t, x, y);

    if (onClickHandler) {
      const rect = {
        x,
        y: y - textWidth,
        width: textWidth,
        height: textWidth + 4,
      };
      registerClickHandler(rect, onClickHandler);
    }

    ctx.restore();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { width, height } = getCanvasDim();
    const { radius = 100, color, contour, gradient } = data || {};
    ctx.save();
    const drawPath = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(
        toAbsolute(data.x, width),
        toAbsolute(data.y, height),
        toAbsolute(radius, height),
        0,
        TWO_PI
      );
    };

    if (contour) {
      ctx.strokeStyle = contour.color;
      ctx.lineWidth = contour.lineWidth || 1;
      drawPath(ctx);
      ctx.stroke();
    }

    if (color) {
      ctx.fillStyle = color;
      drawPath(ctx);
      ctx.fill();
    }

    if (gradient) {
      const r = toAbsolute(gradient.radius, height);
      const gx = toAbsolute(gradient.centerX, width);
      const gy = toAbsolute(gradient.centerY, height);
      const grd = ctx.createRadialGradient(gx, gy, r * 0.2, gx, gy, r * 1.5);
      const nColors = gradient.colors.length;
      gradient.colors.forEach((c: string, i: number) =>
        grd.addColorStop(i / nColors, c)
      );
      ctx.fillStyle = grd;

      drawPath(ctx);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawRect = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { width: cW, height: cH } = getCanvasDim();
    const {
      x,
      y,
      length,
      width = length,
      height = length,
      color,
      contour,
    } = data || {};

    ctx.save();
    const drawPath = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.rect(
        toAbsolute(x, cW),
        toAbsolute(y, cH),
        toAbsolute(width, cW),
        toAbsolute(height, length !== undefined ? cW : cH)
      );
    };

    if (contour) {
      ctx.strokeStyle = contour.color;
      ctx.lineWidth = contour.lineWidth || 1;
      drawPath(ctx);
      ctx.stroke();
    }

    if (color) {
      ctx.fillStyle = color;
      drawPath(ctx);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawVideo = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      fps = 10,
      looped = false,
      data: blob,
    } = data;
    const video = document.createElement("video");
    if (looped) {
      video.setAttribute("loop", "");
    }
    const url = createObjectURL(blob);
    if (url) {
      video.src = url;
    }

    const looper = () => {
      if (video && !video.paused && !video.ended) {
        ctx.drawImage(video, x, y, width, height);
      }
      setTimeout(looper, 1000 / fps);
    };
    video.addEventListener("loadeddata", () => {
      if (video.src && video.src !== url) {
        revokeObjectURL(video.src); // cleanup the old
      }
      video.play();
      setImmediate(looper);
    });
  };

  const drawArray = (ctx: CanvasRenderingContext2D, params: any) => {
    if (!canvasRef.current) {
      return;
    }

    const { data }: { data: Array<number> } = params;
    const n = data.length;

    const min = minArrayElem(data);
    const max = maxArrayElem(data);

    const rect = canvasRef.current.getBoundingClientRect();
    const halfHeight = rect.height / 2;

    const binWidth = rect.width / n;
    ctx.strokeStyle = `gray`;
    for (let i = 0; i < n; ++i) {
      const v = data[i];
      ctx.beginPath();
      ctx.moveTo(i * binWidth, halfHeight);
      if (v > 0) {
        ctx.lineTo(i * binWidth, halfHeight - halfHeight * (v / max));
      } else {
        ctx.lineTo(i * binWidth, halfHeight + halfHeight * (v / min));
      }
      ctx.stroke();
    }
  };

  const drawArray2d = (ctx: CanvasRenderingContext2D, params: any) => {
    if (!canvasRef.current) {
      return;
    }

    const { data, cols: nCols, rows: nRows } = params;
    const n = Math.min(data.length, nRows * nCols);

    const normaliseValues = false;
    const slice: Array<number> = data.slice(0, n);
    const min = normaliseValues ? minArrayElem(slice) : undefined;
    const max = normaliseValues ? maxArrayElem(slice) : undefined;
    const range =
      normaliseValues && max !== undefined && min !== undefined
        ? max - min
        : undefined;

    const rect = canvasRef.current.getBoundingClientRect();
    const cellWidth = rect.width / nCols;
    const cellHeight = rect.height / nRows;
    for (let i = 0; i < n; ++i) {
      const value = data[i];
      const valueHex = value.toString(16);
      const row = Math.floor(i / nCols);
      const col = i % nCols;
      if (normaliseValues) {
        ctx.fillStyle =
          range && min !== undefined
            ? `rgb(${((value - min) / range) * 255}, 0, 0)`
            : "";
        ctx.strokeStyle =
          range && min !== undefined
            ? `rgb(${((value - min) / range) * 255}, 0, 0)`
            : "";
      } else {
        ctx.fillStyle = `#${valueHex}${valueHex}${valueHex}`;
        ctx.strokeStyle = `#${valueHex}${valueHex}${valueHex}`;
      }
      const x = col * cellWidth;
      const y = row * cellHeight;
      ctx.beginPath();
      ctx.rect(x, y, cellWidth, cellHeight);
      ctx.stroke();
      ctx.fillRect(x, y, cellWidth, cellHeight);
    }
  };

  const update = (objectOrArray: any | Array<any>) => {
    recentDataRef.current = objectOrArray;
    if (!canvasRef.current || !objectOrArray) {
      // nothing to render, or nowhere to render to
      return;
    }

    clickHandlersRef.current = {};

    const dataArray =
      Array.isArray(objectOrArray) || ArrayBuffer.isView(objectOrArray)
        ? objectOrArray
        : [objectOrArray];
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      return;
    }

    if (clearOnRedrawRef.current) {
      ctx.fillStyle = "#FFF";
      ctx.strokeStyle = "#FFF";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    for (const data of dataArray as any) {
      // TODO: any
      if (data) {
        switch (data.type) {
          case "image":
            drawImage(ctx, data);
            break;
          case "text":
            drawText(ctx, data);
            break;
          case "circle":
            drawCircle(ctx, data);
            break;
          case "rect":
          case "square":
            drawRect(ctx, data);
            break;
          case "video":
            drawVideo(ctx, data);
            break;
          case "explainer":
            drawExplainer(ctx, data);
            break;
          case "array2d":
            drawArray2d(ctx, data);
            break;
          case "array":
            drawArray(ctx, data);
            break;
          default:
            break;
        }
      }
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
            update(recentDataRef.current);
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
      update(recentDataRef.current);
    }

    if (newCapture !== undefined) {
      setCapture(newCapture);
      captureRef.current = newCapture;
    }
    if (render) {
      const { captureMime, frameID } = notification;
      update(render);
      if (captureMime && canvasRef.current) {
        canvasRef.current.toBlob(
          (blob) =>
            props.service.configure({
              capturedFrame: {
                frameID,
                blob,
              },
            }),
          captureMime
        );
      }
    }
  };

  const onInit = (initialState: any) => {
    const { size, resizable: newResizable, fullscreen: newFullscreen, clearOnRedraw: newClearOnRedraw = true } = initialState;

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

function maxArrayElem<T>(arr: Array<T>): T {
  return arr.reduce((max, cur) => (cur > max ? cur : max), arr[0]);
}

function minArrayElem<T>(arr: Array<T>): T {
  return arr.reduce((min, cur) => (cur < min ? cur : min), arr[0]);
}

function toAbsolute(value: string | undefined, upper: number): number {
  if (value === undefined || upper === undefined) {
    return 0;
  }
  if (typeof value === "string") {
    const components = value.split("%");
    if (components.length > 1) {
      return (Number(components[0]) / 100) * upper;
    }
  }
  return Number(value);
}
