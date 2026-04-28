import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasWidget } from "../../types";
import { findService } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";
import { update } from "hkp-frontend/src/runtime/browser/services/CanvasUI/canvasDraw";

export function CanvasRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<CanvasWidget>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recentDataRef = useRef<any>(undefined);
  const imageCacheRef = useRef<Record<string, any>>({});
  const clearOnRedrawRef = useRef<boolean>(true);
  const [size, setSize] = useState<[number, number]>([400, 250]);

  const service = useMemo(
    () => findService(boardContext, widget.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.serviceUuid],
  );

  const triggerUpdate = (data: any) => {
    recentDataRef.current = data;
    if (!canvasRef.current) {
      return;
    }
    update(
      canvasRef.current,
      data,
      clearOnRedrawRef.current,
      imageCacheRef.current,
      () => {},
    );
  };

  useEffect(() => {
    if (!service?.app) {
      return;
    }

    // Read initial state
    service.getConfiguration?.().then?.((state: any) => {
      if (state?.clearOnRedraw !== undefined) {
        clearOnRedrawRef.current = state.clearOnRedraw;
      }
      if (state?.size) {
        setSize(state.size);
      }
    });

    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      if (notification?.size) {
        setSize(notification.size);
      }
      if (notification?.render !== undefined) {
        triggerUpdate(notification.render);
      }
    };

    service.app.registerNotificationTarget?.(service, handler);
    return () => {
      service.app.unregisterNotificationTarget?.(service, handler);
    };
  }, [service]);

  return (
    <div
      style={{
        display: "inline-block",
        border: "1px solid hsl(var(--border))",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={size[0]}
        height={size[1]}
        style={{ width: size[0], height: size[1], display: "block" }}
      />
    </div>
  );
}
