import { useState, useEffect, useMemo } from "react";
import LineChart, {
  SeriesPoint,
} from "hkp-frontend/src/ui-components/LineChart";
import { LineChartWidget } from "../../types";
import { findService, resolvePath } from "../../findService";
import { WidgetRendererProps } from "../widgetRegistry";

const DEFAULT_MAX_POINTS = 200;

export function LineChartRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<LineChartWidget>) {
  const maxPoints = widget.maxPoints ?? DEFAULT_MAX_POINTS;
  const [series, setSeries] = useState<Record<string, SeriesPoint[]>>({});

  const sourceService = useMemo(
    () => findService(boardContext, widget.source.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.source.serviceUuid],
  );

  useEffect(() => {
    if (!sourceService?.app) {
      return;
    }
    const handler = (notification: any) => {
      if (notification?.__internal) {
        return;
      }
      const val = widget.source.path
        ? resolvePath(notification, widget.source.path)
        : notification;
      if (!val || typeof val !== "object") {
        return;
      }
      const { symbol, price, time } = val as Record<string, any>;
      if (!symbol || typeof price !== "number") {
        return;
      }
      // When a symbol filter is set, ignore all other symbols.
      if (widget.symbol && symbol !== widget.symbol) {
        return;
      }
      const t = time ? new Date(time).getTime() : Date.now();
      if (!Number.isFinite(t) || !Number.isFinite(price)) {
        return;
      }
      setSeries((prev) => {
        const existing = prev[symbol] ?? [];
        const next = [...existing, { time: t, price }];
        return {
          ...prev,
          [symbol]: next.length > maxPoints ? next.slice(-maxPoints) : next,
        };
      });
    };
    sourceService.app.registerNotificationTarget?.(sourceService, handler);
    return () => {
      sourceService.app.unregisterNotificationTarget?.(sourceService, handler);
    };
  }, [sourceService, widget.source.path, maxPoints, widget.symbol]);

  return (
    <LineChart
      series={series}
      height={widget.height}
      width={widget.width}
      normalize={widget.normalize}
    />
  );
}
