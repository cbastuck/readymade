import { Component, MouseEvent } from "react";
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

type State = {
  fullWidth: number;
  fullHeight: number;
  fullscreen: boolean;
  clearOnRedraw: boolean;
  canvasWidth: number;
  canvasHeight: number;
  resizable: boolean;
  capture: boolean;
};

export default class CanvasUI extends Component<ServiceUIProps, State> {
  state: State = {
    fullWidth: document.body.clientWidth,
    fullHeight: document.body.clientHeight,
    fullscreen: false,
    clearOnRedraw: true,
    canvasWidth: 400,
    canvasHeight: 250,
    resizable: true,
    capture: false,
  };

  imageCache: { [key: string]: any } = {};
  clickHandlers: { [key: string]: { rect: Rect; action: ServiceAction } } = {};

  resizeBodyObserver?: ResizeObserver;
  recentData?: any;

  canvas: HTMLCanvasElement | null = null;

  componentDidMount() {
    this.resizeBodyObserver = new ResizeObserver(this.onResizeBodyEvent);
    this.resizeBodyObserver.observe(document.body);
  }

  componentWillUnmount() {
    this.resizeBodyObserver?.disconnect();
  }

  onResizeBodyEvent = (entries: ResizeObserverEntry[]) => {
    const entry = entries && entries[0];
    if (entry) {
      this.setState(
        {
          fullWidth: document.body.clientWidth,
          fullHeight: document.body.clientHeight,
        },
        () => this.update(this.recentData || {})
      );
    }
  };

  getCanvasDim = () => {
    return {
      width: this.canvas?.width || 0,
      height: this.canvas?.height || 0,
    };
  };

  getCanvasCenter = () => {
    const { width, height } = this.getCanvasDim();
    const centerX = width / 2;
    const centerY = height / 2;
    return {
      centerX,
      centerY,
      canvasWidth: width,
      canvasHeight: height,
    };
  };

  fetchImage = (url: string) => {
    return new Promise((resolve) => {
      const image = this.imageCache[url];
      if (!image) {
        const img = new Image();
        img.onload = () => {
          this.imageCache[url] = img;
          resolve(img);
        };
        img.src = url;
      } else {
        resolve(image);
      }
    });
  };

  createImage = (blob: Blob | typeof Image) => {
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

  registerClickHandler = (rect: Rect, action: ServiceAction) => {
    const id = `${rect.x}${rect.y}`;
    this.clickHandlers[id] = { rect, action };
  };

  onClick = (service: ServiceInstance, ev: MouseEvent) => {
    const { clientX: x, clientY: y } = ev;
    for (const id in this.clickHandlers) {
      const { rect, action } = this.clickHandlers[id];
      if (
        x >= rect.x &&
        x <= rect.x + (Number(rect.width) || 0) &&
        y >= rect.y &&
        y <= rect.y + (Number(rect.height) || 0)
      ) {
        return this.invokeClickAction(service, action);
      }
    }
  };

  invokeClickAction = (service: ServiceInstance, action: any) => {
    if (action.internal) {
      // internal dispatch event
      service.app.next(service, action.internal);
    } else {
      // external action
      service.app.sendAction(action);
    }
  };

  drawExplainer = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const {
      pointer = { x: "50%", y: "50%", length: "1%" },
      text,
      font,
      color,
      textTransform,
      direction = "left-to-right",
    } = data;
    const ltr = direction === "left-to-right";
    const { canvasWidth, canvasHeight } = this.getCanvasCenter();

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
    this.drawText(ctx, textData);
  };

  drawImage = async (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const {
      centerX: canvasCenterX,
      centerY: canvasCenterY,
      canvasWidth,
      canvasHeight,
    } = this.getCanvasCenter();

    const {
      url,
      data: blob,
      opacity,
      height = "100%",
      unscaled,
      onClick,
      centerX,
      centerY,
      x,
      y,
    } = data;
    const img = (
      url ? await this.fetchImage(url) : await this.createImage(blob)
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
    if (onClick) {
      this.registerClickHandler(rect, onClick);
    }
    ctx.save();
    if (opacity !== undefined) {
      ctx.globalAlpha = opacity;
    }
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  };

  applyTextTransform = (input: string, operation: string) => {
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

  drawText = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { centerX, centerY, canvasWidth, canvasHeight } =
      this.getCanvasCenter();
    const {
      font = "30px Arial",
      text,
      x: dx,
      y: dy,
      onClick,
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
      ? this.applyTextTransform(text, textTransform)
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

    if (onClick) {
      const rect = {
        x,
        y: y - textWidth,
        width: textWidth,
        height: textWidth + 4,
      };
      this.registerClickHandler(rect, onClick);
    }

    ctx.restore();
  };

  drawCircle = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { width, height } = this.getCanvasDim();
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

  drawRect = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasDim();
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
        toAbsolute(x, canvasWidth),
        toAbsolute(y, canvasHeight),
        toAbsolute(width, canvasWidth),
        toAbsolute(height, length !== undefined ? canvasWidth : canvasHeight)
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

  drawVideo = (ctx: CanvasRenderingContext2D, data: DrawElement) => {
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

  drawArray = (ctx: CanvasRenderingContext2D, params: any) => {
    if (!this.canvas) {
      return;
    }

    const { data }: { data: Array<number> } = params;
    const n = data.length;

    const min = minArrayElem(data);
    const max = maxArrayElem(data);

    const rect = this.canvas.getBoundingClientRect();
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

  drawArray2d = (ctx: CanvasRenderingContext2D, params: any) => {
    if (!this.canvas) {
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

    const rect = this.canvas.getBoundingClientRect();
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

  update = (objectOrArray: any | Array<any>) => {
    this.recentData = objectOrArray;
    if (!this.canvas || !objectOrArray) {
      // nothing to render, or nowhere to render to
      return;
    }

    this.clickHandlers = {};

    const dataArray =
      Array.isArray(objectOrArray) || ArrayBuffer.isView(objectOrArray)
        ? objectOrArray
        : [objectOrArray];
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    if (this.state.clearOnRedraw) {
      ctx.fillStyle = "#FFF";
      ctx.strokeStyle = "#FFF";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    //const isPureNumberArray = !dataArray.some((x) => isNaN(Number(x)));
    //if (isPureNumberArray) {
    //  this.drawArray2d(ctx, dataArray);
    //}

    for (const data of dataArray as any) {
      // TODO: any
      if (data) {
        switch (data.type) {
          case "image":
            this.drawImage(ctx, data);
            break;
          case "text":
            this.drawText(ctx, data);
            break;
          case "circle":
            this.drawCircle(ctx, data);
            break;
          case "rect":
          case "square":
            this.drawRect(ctx, data);
            break;
          case "video":
            this.drawVideo(ctx, data);
            break;
          case "explainer":
            this.drawExplainer(ctx, data);
            break;
          case "array2d":
            this.drawArray2d(ctx, data);
            break;
          case "array":
            this.drawArray(ctx, data);
            break;
          default:
            break;
        }
      }
    }
  };

  renderMain = (service: ServiceInstance) => {
    const {
      canvasWidth,
      canvasHeight,
      fullWidth,
      fullHeight,
      fullscreen: showFullscreen,
      resizable,
    } = this.state;

    const fullscreen = showFullscreen || service.fullscreen;
    const width = fullscreen ? fullWidth : canvasWidth;
    const height = fullscreen ? fullHeight : canvasHeight - 4; // TODO: could not figure out why we grows otherwise
    return (
      <canvas
        ref={(ref) => (this.canvas = ref)}
        style={{
          position: fullscreen ? "fixed" : undefined,
          top: fullscreen ? 0 : undefined,
          left: fullscreen ? 0 : undefined,
          zIndex: fullscreen ? zLayers.foreground : undefined,
          width,
          height,
        }}
        onDoubleClick={() => {
          if (resizable && !service.noToggleFullscreenOnDblClick) {
            const toggled = !fullscreen;
            service.fullscreen = toggled;
            this.setState({ fullscreen: toggled }, () =>
              this.update(this.recentData)
            );
          }
        }}
        onClick={this.onClick.bind(this, service)}
        width={width}
        height={height}
      />
    );
  };

  onNotification = (notification: any) => {
    const { render, size, capture } = notification;
    if (size !== undefined) {
      const [canvasWidth, canvasHeight] = size;
      this.setState({ canvasWidth, canvasHeight }, () =>
        this.update(this.recentData)
      );
    }

    if (capture !== undefined) {
      this.setState({ capture });
    }
    if (render) {
      const { captureMime, frameID } = notification;
      this.update(render);
      if (captureMime && this.canvas) {
        this.canvas.toBlob(
          (blob) =>
            this.props.service.configure({
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

  onInit = (initialState: any) => {
    const { size, resizable, fullscreen, clearOnRedraw = true } = initialState;

    const config: any = {
      resizable: !!resizable,
      fullscreen,
      clearOnRedraw,
    };
    if (size) {
      config.canvasWidth = size[0];
      config.canvasHeight = size[1];
    }
    this.setState(config);
  };

  onResize = (service: ServiceInstance, { width, height }: Size) => {
    service.configure({ size: [width, height] });
  };

  render() {
    const { resizable } = this.state;
    const { service } = this.props;

    const onCopyDataURL = () => {
      if (this.canvas) {
        const dataUrl = this.canvas.toDataURL();
        navigator.clipboard.writeText(dataUrl);
      }
    };

    const onToggleOutputImage = () =>
      service.configure({ capture: !this.state.capture });
    const customMenuEntries = [
      {
        name: "Copy Data URL",
        icon: <MenuIcon icon={BinaryIcon} />,
        onClick: onCopyDataURL,
      },
      {
        name: `Output Blob ${this.state.capture ? "[is on]" : "[is off]"}`,
        icon: (
          <MenuIcon
            icon={this.state.capture ? ToggleRight : ToggleLeft}
            className={this.state.capture ? "stroke-sky-600" : ""}
          />
        ),
        onClick: onToggleOutputImage,
      },
    ];
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        onResize={this.onResize}
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
          {this.renderMain(service)}
        </div>
      </ServiceUI>
    );
  }
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
