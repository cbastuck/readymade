import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  drawText,
  drawCircle,
  drawRect,
  update,
  DrawContext,
} from "../canvasDraw";

// NOTE: fetchImage, createImage, and drawVideo are not tested here because they
// require real browser APIs (Image constructor with network loading, URL.createObjectURL,
// HTMLVideoElement, setImmediate) that are not reliably available in jsdom.

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 50 })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    globalAlpha: 1,
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function makeDim(overrides: Partial<DrawContext> = {}): DrawContext {
  return {
    width: 400,
    height: 300,
    imageCache: {},
    registerClickHandler: vi.fn(),
    ...overrides,
  };
}

function makeCanvas(width = 400, height = 300) {
  const ctx = makeCtx();
  return {
    width,
    height,
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(
      () => ({ width, height, x: 0, y: 0, top: 0, left: 0 } as DOMRect),
    ),
    _ctx: ctx,
  } as unknown as HTMLCanvasElement & { _ctx: CanvasRenderingContext2D };
}

// ─── drawText ────────────────────────────────────────────────────────────────

describe("drawText", () => {
  it("calls ctx.fillText with the text value", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawText(ctx, { type: "text", text: "hello" }, dim);
    expect(ctx.fillText).toHaveBeenCalledWith("hello", expect.any(Number), expect.any(Number));
  });

  it("centers the text when no x/y is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim({ width: 400, height: 300 });
    // measureText returns width: 50, so centered x = 400/2 - 50/2 = 175
    // centered y = 300/2 = 150
    drawText(ctx, { type: "text", text: "hi" }, dim);
    expect(ctx.fillText).toHaveBeenCalledWith("hi", 175, 150);
  });

  it("uses explicit x/y when provided", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawText(ctx, { type: "text", text: "hi", x: 10, y: 20 }, dim);
    expect(ctx.fillText).toHaveBeenCalledWith("hi", 10, 20);
  });

  it("calls registerClickHandler when data has an onClick", () => {
    const ctx = makeCtx();
    const registerClickHandler = vi.fn();
    const dim = makeDim({ registerClickHandler });
    const onClickAction = { action: "notification" };
    drawText(ctx, { type: "text", text: "click me", onClick: onClickAction }, dim);
    expect(registerClickHandler).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      onClickAction,
    );
  });

  it("applies textTransform when set", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawText(ctx, { type: "text", text: "hello", textTransform: "uppercase" }, dim);
    expect(ctx.fillText).toHaveBeenCalledWith("HELLO", expect.any(Number), expect.any(Number));
  });
});

// ─── drawCircle ──────────────────────────────────────────────────────────────

describe("drawCircle", () => {
  it("calls ctx.arc with the correct radius", () => {
    const ctx = makeCtx();
    const dim = makeDim({ width: 400, height: 300 });
    drawCircle(ctx, { x: "50%", y: "50%", radius: 50, color: "red" }, dim);
    // radius toAbsolute(50, 300) = 50 (plain number)
    expect(ctx.arc).toHaveBeenCalledWith(200, 150, 50, 0, expect.any(Number));
  });

  it("calls ctx.fill when color is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawCircle(ctx, { x: 0, y: 0, color: "blue" }, dim);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("calls ctx.stroke when contour is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawCircle(ctx, { x: 0, y: 0, contour: { color: "black", lineWidth: 2 } }, dim);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("creates a radial gradient when gradient data is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim({ width: 400, height: 300 });
    drawCircle(
      ctx,
      {
        x: 0,
        y: 0,
        gradient: {
          radius: 100,
          centerX: "50%",
          centerY: "50%",
          colors: ["red", "blue"],
        },
      },
      dim,
    );
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ─── drawRect ────────────────────────────────────────────────────────────────

describe("drawRect", () => {
  it("calls ctx.rect and ctx.fill when color is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawRect(ctx, { x: 10, y: 10, width: 50, height: 50, color: "red" }, dim);
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("calls ctx.stroke when contour is provided", () => {
    const ctx = makeCtx();
    const dim = makeDim();
    drawRect(
      ctx,
      { x: 10, y: 10, width: 50, height: 50, contour: { color: "black", lineWidth: 1 } },
      dim,
    );
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe("update", () => {
  it("clears the canvas with fillRect when clearOnRedraw is true", async () => {
    const canvas = makeCanvas();
    await update(canvas, { type: "text", text: "hi" }, true, {}, vi.fn());
    expect(canvas._ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
  });

  it("does NOT call fillRect to clear when clearOnRedraw is false", async () => {
    const canvas = makeCanvas();
    await update(canvas, { type: "text", text: "hi" }, false, {}, vi.fn());
    expect(canvas._ctx.fillRect).not.toHaveBeenCalled();
  });

  it("returns early without error when canvas is null", async () => {
    await expect(
      update(null as unknown as HTMLCanvasElement, { type: "text", text: "hi" }, true, {}, vi.fn()),
    ).resolves.toBeUndefined();
  });

  it("returns early without error when canvas is undefined", async () => {
    await expect(
      update(undefined as unknown as HTMLCanvasElement, { type: "text", text: "hi" }, true, {}, vi.fn()),
    ).resolves.toBeUndefined();
  });

  it("returns early without error when data is falsy", async () => {
    const canvas = makeCanvas();
    await expect(update(canvas, null, true, {}, vi.fn())).resolves.toBeUndefined();
    await expect(update(canvas, undefined, true, {}, vi.fn())).resolves.toBeUndefined();
  });

  it("handles a single object input by wrapping it in an array and drawing it", async () => {
    const canvas = makeCanvas();
    await update(canvas, { type: "text", text: "single" }, true, {}, vi.fn());
    expect(canvas._ctx.fillText).toHaveBeenCalledWith(
      "single",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("handles array input and calls draw functions for each element", async () => {
    const canvas = makeCanvas();
    const data = [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ];
    await update(canvas, data, true, {}, vi.fn());
    expect(canvas._ctx.fillText).toHaveBeenCalledTimes(2);
    expect(canvas._ctx.fillText).toHaveBeenNthCalledWith(
      1,
      "first",
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvas._ctx.fillText).toHaveBeenNthCalledWith(
      2,
      "second",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("creates a fresh DrawContext per call (registerClickHandler is provided per call)", async () => {
    const canvas = makeCanvas();
    const registerClickHandler1 = vi.fn();
    const registerClickHandler2 = vi.fn();

    const onClickAction = { action: "notification" };
    await update(
      canvas,
      { type: "text", text: "t", onClick: onClickAction },
      true,
      {},
      registerClickHandler1,
    );
    await update(
      canvas,
      { type: "text", text: "t", onClick: onClickAction },
      true,
      {},
      registerClickHandler2,
    );

    // Each call's registerClickHandler should be called independently
    expect(registerClickHandler1).toHaveBeenCalledTimes(1);
    expect(registerClickHandler2).toHaveBeenCalledTimes(1);
  });
});
