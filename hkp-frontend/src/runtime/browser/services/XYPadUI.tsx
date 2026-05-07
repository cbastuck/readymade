import { useCallback, useEffect, useRef, useState } from "react";
import { Fullscreen } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";

const THUMB_RADIUS = 18;
const INITIAL_WIDTH = 320;
const INITIAL_HEIGHT = 200;

export default function XYPadUI(props: ServiceUIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Normalized thumb position [0, 1] — stored in a ref to avoid React re-renders on move.
  const thumbRef = useRef({ x: 0.5, y: 0.5 });
  const gridRef = useRef({ rows: 0, cols: 0 });
  // Keep a stable ref to the current service so pointer event handlers never go stale.
  const serviceRef = useRef(props.service);
  serviceRef.current = props.service;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gridRows, setGridRows] = useState(0);
  const [gridCols, setGridCols] = useState(0);

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

    // Crosshairs from thumb to all four edges
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tx, 0);   ctx.lineTo(tx, ty - THUMB_RADIUS);
    ctx.moveTo(tx, ty + THUMB_RADIUS); ctx.lineTo(tx, h);
    ctx.moveTo(0, ty);   ctx.lineTo(tx - THUMB_RADIUS, ty);
    ctx.moveTo(tx + THUMB_RADIUS, ty); ctx.lineTo(w, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Grid lines
    const { rows, cols } = gridRef.current;
    if (rows > 0 || cols > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(150, 150, 160, 0.25)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < rows; i++) {
        const ly = (i / rows) * h;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
      }
      for (let i = 1; i < cols; i++) {
        const lx = (i / cols) * w;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, h);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Thumb — drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(99, 102, 241, 0.25)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, THUMB_RADIUS, 0, Math.PI * 2);
    // Radial gradient: bright highlight offset toward top-left
    const grad = ctx.createRadialGradient(
      tx - THUMB_RADIUS * 0.3, ty - THUMB_RADIUS * 0.3, THUMB_RADIUS * 0.1,
      tx, ty, THUMB_RADIUS,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#eeeef6");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Thumb — border ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx, ty, THUMB_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Thumb — center dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79, 70, 229, 0.85)";
    ctx.fill();
    ctx.restore();
  }, []);

  // Sync canvas pixel buffer with its display size (handles retina and resize).
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
      const { rows, cols } = gridRef.current;
      const position: any = { x: pos.x, y: pos.y };
      if (rows > 0) {
        position.row = Math.floor(pos.y * rows);
      }
      if (cols > 0) {
        position.column = Math.floor(pos.x * cols);
      }
      serviceRef.current.configure({ position, eventType });
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
  }, [draw, syncSize]);

  // Sync grid ref and redraw when service notifies a grid change.
  useEffect(() => {
    gridRef.current = { rows: gridRows, cols: gridCols };
    draw();
  }, [gridRows, gridCols, draw]);

  const onNotification = (notification: any) => {
    if (notification?.gridRows !== undefined) {
      setGridRows(notification.gridRows);
    }
    if (notification?.gridCols !== undefined) {
      setGridCols(notification.gridCols);
    }
  };

  const onInit = (state: any) => {
    if (state?.gridRows !== undefined) {
      setGridRows(state.gridRows);
    }
    if (state?.gridCols !== undefined) {
      setGridCols(state.gridCols);
    }
  };

  const customMenuEntries = [
    {
      name: "Fullscreen",
      icon: <MenuIcon icon={Fullscreen} />,
      disabled: isFullscreen,
      onClick: () => setIsFullscreen(true),
    },
  ];

  const canvasEl = (
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
  );

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
      initialSize={{ width: INITIAL_WIDTH, height: INITIAL_HEIGHT }}
    >
      {isFullscreen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "white",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            className="hkp-svc-btn absolute top-0 right-0 z-[1001]"
            onClick={() => setIsFullscreen(false)}
          >
            ✕
          </Button>
          <div style={{ flex: 1 }}>{canvasEl}</div>
        </div>
      ) : (
        canvasEl
      )}
    </ServiceUI>
  );
}
