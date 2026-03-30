import { toAbsolute, applyTextTransform, maxArrayElem, minArrayElem } from "./canvasUtils";
import { createObjectURL, revokeObjectURL } from "../helpers";

const TWO_PI = 2 * Math.PI;

export type DrawContext = {
  width: number;
  height: number;
  imageCache: Record<string, HTMLImageElement>;
  registerClickHandler: (
    rect: { x: number; y: number; width: number; height: number },
    action: any,
  ) => void;
};

export function fetchImage(
  cache: Record<string, HTMLImageElement>,
  url: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = cache[url];
    if (!image) {
      const img = new Image();
      img.onload = () => {
        cache[url] = img;
        resolve(img);
      };
      img.src = url;
    } else {
      resolve(image);
    }
  });
}

export function createImage(
  blob: Blob | HTMLImageElement,
): Promise<HTMLImageElement> {
  if (blob instanceof window.Image) {
    return Promise.resolve(blob); // already an image
  }
  return new Promise((resolve, reject) => {
    const imageUrl = createObjectURL(blob as Blob);
    if (imageUrl) {
      const img = new Image();
      img.addEventListener("load", () => {
        revokeObjectURL(imageUrl);
        resolve(img);
      });
      img.addEventListener("error", () => {
        revokeObjectURL(imageUrl);
        reject(new Error("Could not load image from blob"));
      });
      img.src = imageUrl;
    } else {
      reject(new Error("Could not create image URL"));
    }
  });
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  data: any,
  dim: DrawContext,
): void {
  const { width: canvasWidth, height: canvasHeight } = dim;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

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

  const t = textTransform ? applyTextTransform(text, textTransform) : text;
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
    dim.registerClickHandler(rect, onClickHandler);
  }

  ctx.restore();
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  data: any,
  dim: Pick<DrawContext, "width" | "height">,
): void {
  const { width, height } = dim;
  const { radius = 100, color, contour, gradient } = data || {};
  ctx.save();
  const drawPath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(
      toAbsolute(data.x, width),
      toAbsolute(data.y, height),
      toAbsolute(radius, height),
      0,
      TWO_PI,
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
      grd.addColorStop(i / nColors, c),
    );
    ctx.fillStyle = grd;

    drawPath(ctx);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  data: any,
  dim: Pick<DrawContext, "width" | "height">,
): void {
  const { width: cW, height: cH } = dim;
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
      toAbsolute(height, length !== undefined ? cW : cH),
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
}

export async function drawImage(
  ctx: CanvasRenderingContext2D,
  data: any,
  dim: DrawContext,
): Promise<void> {
  const { width: canvasWidth, height: canvasHeight } = dim;
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

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
    url
      ? await fetchImage(dim.imageCache, url)
      : await createImage(blob)
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
    dim.registerClickHandler(rect, onClickHandler);
  }
  ctx.save();
  if (opacity !== undefined) {
    ctx.globalAlpha = opacity;
  }
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

export function drawVideo(ctx: CanvasRenderingContext2D, data: any): void {
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
}

export function drawArray(
  ctx: CanvasRenderingContext2D,
  params: any,
  dim: Pick<DrawContext, "width" | "height">,
): void {
  const { data }: { data: Array<number> } = params;
  const n = data.length;

  const min = minArrayElem(data);
  const max = maxArrayElem(data);

  const halfHeight = dim.height / 2;

  const binWidth = dim.width / n;
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
}

export function drawArray2d(
  ctx: CanvasRenderingContext2D,
  params: any,
  dim: Pick<DrawContext, "width" | "height">,
): void {
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

  const cellWidth = dim.width / nCols;
  const cellHeight = dim.height / nRows;
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
}

export function drawExplainer(
  ctx: CanvasRenderingContext2D,
  data: any,
  dim: DrawContext,
): void {
  const {
    pointer = { x: "50%", y: "50%", length: "1%" },
    text,
    font,
    color,
    textTransform,
    direction = "left-to-right",
  } = data;
  const ltr = direction === "left-to-right";
  const { width: canvasWidth, height: canvasHeight } = dim;

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
  drawText(ctx, textData, dim);
}

export async function update(
  canvas: HTMLCanvasElement,
  objectOrArray: any,
  clearOnRedraw: boolean,
  imageCache: Record<string, HTMLImageElement>,
  registerClickHandler: DrawContext["registerClickHandler"],
): Promise<void> {
  if (!canvas || !objectOrArray) {
    // nothing to render, or nowhere to render to
    return;
  }

  const dataArray =
    Array.isArray(objectOrArray) || ArrayBuffer.isView(objectOrArray)
      ? objectOrArray
      : [objectOrArray];
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dim: DrawContext = {
    width: canvas.width,
    height: canvas.height,
    imageCache,
    registerClickHandler,
  };

  if (clearOnRedraw) {
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#FFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (const data of dataArray as any) {
    // TODO: any
    if (data) {
      switch (data.type) {
        case "image":
          await drawImage(ctx, data, dim);
          break;
        case "text":
          drawText(ctx, data, dim);
          break;
        case "circle":
          drawCircle(ctx, data, dim);
          break;
        case "rect":
        case "square":
          drawRect(ctx, data, dim);
          break;
        case "video":
          drawVideo(ctx, data);
          break;
        case "explainer":
          drawExplainer(ctx, data, dim);
          break;
        case "array2d":
          drawArray2d(ctx, data, dim);
          break;
        case "array":
          drawArray(ctx, data, dim);
          break;
        default:
          break;
      }
    }
  }
}
