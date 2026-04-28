import { useCallback, useEffect, useMemo, useRef } from "react";
import { XYPadWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

const THUMB_RADIUS = 18;

export function XYPadRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<XYPadWidget>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef({ x: 0.5, y: 0.5 });

  const service = useMemo(
    () => findService(boardContext, widget.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.serviceUuid],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    const tx = thumbRef.current.x * w;
    const ty = thumbRef.current.y * h;

    // Crosshairs
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, 0); ctx.lineTo(tx, ty - THUMB_RADIUS);
    ctx.moveTo(tx, ty + THUMB_RADIUS); ctx.lineTo(tx, h);
    ctx.moveTo(0, ty); ctx.lineTo(tx - THUMB_RADIUS, ty);
    ctx.moveTo(tx + THUMB_RADIUS, ty); ctx.lineTo(w, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Thumb shadow
    ctx.save();
    ctx.shadowColor = "rgba(99, 102, 241, 0.25)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, THUMB_RADIUS, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      tx - THUMB_RADIUS * 0.3, ty - THUMB_RADIUS * 0.3, THUMB_RADIUS * 0.1,
      tx, ty, THUMB_RADIUS,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#eeeef6");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Thumb border
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx, ty, THUMB_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Thumb center dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79, 70, 229, 0.85)";
    ctx.fill();
    ctx.restore();
  }, []);

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      };
    };

    const emit = (pos: { x: number; y: number }, eventType: string) => {
      service?.configure({ position: { x: pos.x, y: pos.y }, eventType });
    };

    const onPointerMove = (e: PointerEvent) => {
      const pos = getPos(e);
      thumbRef.current = pos;
      draw();
      emit(pos, "move");
    };

    const onPointerUp = (e: PointerEvent) => {
      canvas.releasePointerCapture(e.pointerId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      emit(getPos(e), "stop");
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      const pos = getPos(e);
      thumbRef.current = pos;
      draw();
      emit(pos, "start");
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [draw, syncSize, service]);

  const w = widget.width ?? 400;
  const h = widget.height ?? 180;

  return (
    <div
      style={{
        width: w,
        height: h,
        flexShrink: 0,
        border: "1px solid hsl(var(--border))",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
    </div>
  );
}
