import { useState, useEffect } from "react";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeWidgetSource, StatusIndicatorWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

const DEFAULT_DOT_COLOR = "#6b7280";

// Enable with: localStorage.setItem("hkp-facade-debug", "1") + reload.
function debugLog(...args: unknown[]) {
  if (localStorage.getItem("hkp-facade-debug") === "1") {
    console.log("[facade-source]", ...args);
  }
}

/**
 * Latest value a service notification carried at `source.path`. Notifications
 * without that path (e.g. unrelated state updates) keep the previous value.
 * Also used by ButtonRenderer for the in-button indicator dot.
 */
export function useNotificationValue(
  boardContext: BoardContextState,
  source: FacadeWidgetSource | undefined,
): unknown {
  const [value, setValue] = useState<unknown>(undefined);
  const [sourceService, setSourceService] = useState<ReturnType<typeof findService>>(null);

  // Browser service instances are appended into their runtime scope by
  // mutation, possibly after the facade has mounted — a one-shot lookup can
  // miss them and would never re-run. Poll until the service appears.
  useEffect(() => {
    if (!source) {
      return;
    }
    const resolve = (svc: NonNullable<ReturnType<typeof findService>>) => {
      setSourceService(svc);
      // Seed from the service's current state so the widget shows a real
      // value (e.g. isRecording: false) before the first notification.
      if (source.path && svc.state) {
        const seed = resolvePath(svc.state, source.path);
        if (seed !== undefined) {
          setValue((prev: unknown) => (prev === undefined ? seed : prev));
        }
      }
    };
    const found = findService(boardContext, source.serviceUuid);
    if (found) {
      debugLog(source.serviceUuid, "resolved immediately", found);
      resolve(found);
      return;
    }
    debugLog(source.serviceUuid, "not found yet — polling");
    const timer = setInterval(() => {
      const svc = findService(boardContext, source.serviceUuid);
      if (svc) {
        debugLog(source.serviceUuid, "resolved by polling", svc);
        resolve(svc);
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [boardContext.scopes, boardContext.services, source?.serviceUuid]);

  useEffect(() => {
    if (!sourceService?.app || !source) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const val = source.path
        ? resolvePath(notification, source.path)
        : notification;
      debugLog(source.serviceUuid, "notification", notification, "->", source.path, "=", val);
      if (val !== undefined) {
        setValue(val);
      }
    };
    if (!sourceService.app.registerNotificationTarget) {
      debugLog(source.serviceUuid, "app has NO registerNotificationTarget", sourceService.app);
      return;
    }
    debugLog(source.serviceUuid, "subscribed");
    sourceService.app.registerNotificationTarget(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, source?.path]);

  return value;
}

/** Booleans and other non-strings match via String(value), so a mic's
 * `isRecording: true` maps through `statusColors: { "true": "#ef4444" }`. */
export function statusColor(
  value: unknown,
  statusColors: Record<string, string> | undefined,
): string {
  if (value === undefined || value === null) {
    return DEFAULT_DOT_COLOR;
  }
  return statusColors?.[String(value)] ?? DEFAULT_DOT_COLOR;
}

export function StatusDot({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    />
  );
}

export function StatusIndicatorRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<StatusIndicatorWidget>) {
  const value = useNotificationValue(boardContext, widget.source);
  return <StatusDot color={statusColor(value, widget.statusColors)} />;
}
