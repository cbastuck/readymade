import { useState, useEffect } from "react";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeWidgetSource, StatusIndicatorWidget } from "../../types";
import { resolvePath } from "../../readValue";
import {
  facadeDebugLog,
  useResolvedService,
  useServiceNotifications,
} from "../../serviceNotifications";
import { WidgetRendererProps } from "../widgetRegistry";

const DEFAULT_DOT_COLOR = "#6b7280";

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
  const sourceService = useResolvedService(boardContext, source?.serviceUuid);

  // Seed from the service's current state so the widget shows a real value
  // (e.g. isRecording: false) before the first notification arrives.
  useEffect(() => {
    if (!sourceService?.state || !source?.path) {
      return;
    }
    const seed = resolvePath(sourceService.state, source.path);
    if (seed === undefined) {
      return;
    }
    setValue((prev: unknown) => (prev === undefined ? seed : prev));
  }, [sourceService, source?.path]);

  useServiceNotifications(sourceService, (notification) => {
    if (!source) {
      return;
    }
    const val = source.path
      ? resolvePath(notification, source.path)
      : notification;
    facadeDebugLog(
      source.serviceUuid,
      "notification",
      notification,
      "->",
      source.path,
      "=",
      val,
    );
    if (val !== undefined) {
      setValue(val);
    }
  });

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
