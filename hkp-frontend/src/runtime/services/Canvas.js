import React, { Component } from "react";
import ResizeObserver from "resize-observer-polyfill";

import ServiceUI from "./ServiceUI";
import { createObjectURL, revokeObjectURL } from "./helpers";
import { t } from "../../styles";

const serviceId = "hookup.to/service/canvas";
const serviceName = "Canvas";

const TWO_PI = 2 * Math.PI;

export class CanvasUI extends Component {
  state = {
    fullWidth: document.body.clientWidth,
    fullHeight: document.body.clientHeight,
    fullscreen: false,
    clearOnRedraw: true,
    canvasWidth: 400,
    canvasHeight: 250,
  };

  imageCache = {};
  clickHandlers = {};

  componentDidMount() {
    this.resizeBodyObserver = new ResizeObserver(this.onResizeBodyEvent);
    this.resizeBodyObserver.observe(document.body);
  }

  componentWillUnmount() {
    this.resizeBodyObserver.disconnect();
  }

  onResizeBodyEvent = (entries) => {
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
      width: this.canvas.width,
      height: this.canvas.height,
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

  fetchImage = (url) => {
    return new Promise((resolve, reject) => {
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

  createImage = (blob) => {
    return new Promise((resolve, reject) => {
      const imageUrl = createObjectURL(blob);
      const img = new Image();
      img.addEventListener("load", () => {
        revokeObjectURL(imageUrl);
        resolve(img);
      });
      img.src = imageUrl;
    });
  };

  registerClickHandler = (rect, action) => {
    const id = `${rect.x}${rect.y}`;
    this.clickHandlers[id] = { rect, action };
  };

  onClick = (service, ev) => {
    const { clientX: x, clientY: y } = ev;
    for (const id in this.clickHandlers) {
      const { rect, action } = this.clickHandlers[id];
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        return this.invokeClickAction(service, action);
      }
    }
  };

  invokeClickAction = (service, action) => {
    if (action.internal) {
      // internal dispatch event
      service.app.next(service, action.internal);
    } else {
      // external action
      service.app.sendAction(action);
    }
  };

  drawExplainer = (ctx, data) => {
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

  drawImage = async (ctx, data) => {
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
    const img = url ? await this.fetchImage(url) : await this.createImage(blob);
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

  applyTextTransform = (input, operation) => {
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

  drawText = (ctx, data) => {
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
      const correctedSize = Math.floor(correctionRatio * 9.9); // we tested with 10pt intially, 9.9 because otherwise we overshoot (not sure why)
      ctx.font = `${style} ${weight} ${correctedSize}px ${family}`;
      textWidth = ctx.measureText(t).width;
    }
    const x =
      dx === undefined ? centerX - textWidth / 2 : toAbsolute(dx, canvasWidth);
    const y = dy === undefined ? centerY : toAbsolute(dy, canvasHeight);
    ctx.fillText(t, x, y);
    ctx.strokeText(t, x, y);

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

  drawCircle = (ctx, data) => {
    const { width, height } = this.getCanvasDim();
    const { radius = 100, color, contour, gradient } = data || {};
    ctx.save();
    const drawPath = (ctx) => {
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
      gradient.colors.forEach((c, i) => grd.addColorStop(i / nColors, c));
      ctx.fillStyle = grd;

      drawPath(ctx);
      ctx.fill();
    }
    ctx.restore();
  };

  drawRect = (ctx, data) => {
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
    const drawPath = (ctx) => {
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

  drawVideo = (ctx, data) => {
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
      video.setAttribute("loop", true);
    }
    const url = createObjectURL(blob);
    video.src = url;
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

  drawArray = (ctx, params) => {
    const { data } = params;
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

  drawArray2d = (ctx, params) => {
    const { data, cols: nCols, rows: nRows } = params;
    const n = Math.min(data.length, nRows * nCols);

    const normaliseValues = false;
    const slice = data.slice(0, n);
    const min = normaliseValues ? minArrayElem(slice) : undefined;
    const max = normaliseValues ? maxArrayElem(slice) : undefined;
    const range = normaliseValues ? max - min : undefined;

    const rect = this.canvas.getBoundingClientRect();
    const cellWidth = rect.width / nCols;
    const cellHeight = rect.height / nRows;
    for (let i = 0; i < n; ++i) {
      const value = data[i];
      const valueHex = value.toString(16);
      const row = Math.floor(i / nCols);
      const col = i % nCols;
      if (normaliseValues) {
        ctx.fillStyle = `rgb(${((value - min) / range) * 255}, 0, 0)`;
        ctx.strokeStyle = `rgb(${((value - min) / range) * 255}, 0, 0)`;
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

  update = (objectOrArray) => {
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
    if (this.state.clearOnRedraw) {
      ctx.fillStyle = "#FFF";
      ctx.strokeStyle = "#FFF";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    //const isPureNumberArray = !dataArray.some((x) => isNaN(Number(x)));
    //if (isPureNumberArray) {
    //  this.drawArray2d(ctx, dataArray);
    //}
    for (const data of dataArray) {
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

  renderMain = ({ service }) => {
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
          zIndex: fullscreen ? t.foreground : undefined,
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

  render() {
    const { resizable } = this.state;
    return (
      <ServiceUI
        {...this.props}
        style={{
          overflow: "hidden",
          padding: resizable ? 5 : 0,
          margin: 0,
        }}
        onInit={this.onInit}
        onNotification={this.onNotification}
        onResize={this.onResize}
        resizable={resizable}
      >
        {this.renderMain}
      </ServiceUI>
    );
  }

  onNotification = (service, notification) => {
    const { render, size } = notification;
    if (size !== undefined) {
      const [canvasWidth, canvasHeight] = size;
      this.setState({ canvasWidth, canvasHeight }, () =>
        this.update(this.recentData)
      );
    }
    if (render) {
      const { captureMime, frameID } = notification;
      this.update(render);
      if (captureMime && this.canvas) {
        this.canvas.toBlob(
          (blob) =>
            service.configure({
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

  onInit = (service) => {
    const { size, resizable, fullscreen, clearOnRedraw } = service;
    const config = {
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

  onResize = (service, { width, height }) => {
    service.configure({ size: [width, height] });
  };
}

class Canvas {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.fullscreen = false;
    this.clearOnRedraw = true;
    this._frameID = 0;
    this._pending = {};
    this.resizable = true;
    this.size = undefined;
    this.reportSizeUpdate = true;
  }

  configure(config) {
    const {
      fullscreen,
      clearOnRedraw,
      noToggleFullscreenOnDblClick,
      capture,
      capturedFrame,
      resizable,
      size,
      reportSizeUpdate,
    } = config || {};
    if (fullscreen !== undefined) {
      this.fullscreen = fullscreen;
    }

    if (clearOnRedraw !== undefined) {
      this.clearOnRedraw = clearOnRedraw;
    }

    if (noToggleFullscreenOnDblClick !== undefined) {
      this.noToggleFullscreenOnDblClick = noToggleFullscreenOnDblClick;
    }

    if (capture !== undefined) {
      this.capture = capture;
    }

    if (capturedFrame !== undefined) {
      this.resolveCapturedFrame(capturedFrame);
    }

    if (resizable !== undefined) {
      this.resizable = resizable;
    }

    if (size !== undefined) {
      this.size = size;
      this.app.notify(this, { size });
      if (this.reportSizeUpdate) {
        const [updatedWidth, updatedHeight] = size;
        this.app.next(this, { updatedWidth, updatedHeight });
      }
    }

    if (reportSizeUpdate !== undefined) {
      this.reportSizeUpdate = reportSizeUpdate;
    }
  }

  resolveCapturedFrame({ blob, frameID }) {
    const { resolve, reject } = this._pending[frameID];
    delete this._pending[frameID];
    if (this._pending[frameID + 1]) {
      reject(frameID); // next frame already scheduled
    } else {
      resolve(blob);
    }
  }

  waitForCapturedFrame(frameID) {
    return new Promise((resolve, reject) => {
      this._pending[frameID] = { resolve, reject };
    });
  }

  async process(params) {
    const frameID = this._frameID++;
    this.app.notify(this, {
      render: params,
      frameID,
      captureMime: this.capture,
    });
    if (this.capture) {
      return await this.waitForCapturedFrame(frameID).catch(
        (/*rejectFrameID*/) => null
      ); // null stops further propagation of droppped frames
    }

    return params;
  }
}

function maxArrayElem(arr) {
  return arr.reduce((max, cur) => (cur > max ? cur : max), arr[0]);
}

function minArrayElem(arr) {
  return arr.reduce((min, cur) => (cur < min ? cur : min), arr[0]);
}

function toAbsolute(value, upper) {
  if (value === undefined || upper === undefined) {
    return 0;
  }
  if (typeof value === "string") {
    const components = value.split("%");
    if (components.length > 1) {
      return (Number(components[0]) / 100) * upper;
    }
  }
  return value;
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Canvas(app, board, descriptor, id),
  createUI: CanvasUI,
};

export default descriptor;
