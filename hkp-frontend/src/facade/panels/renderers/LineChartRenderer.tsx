import { useState, useEffect } from "react";
import LineChart, {
  SeriesPoint,
} from "hkp-frontend/src/ui-components/LineChart";
import { LineChartWidget } from "../../types";
import { resolvePath } from "../../readValue";
import { WidgetRendererProps } from "../widgetRegistry";
import { useNotificationValue } from "./StatusIndicatorRenderer";

const DEFAULT_MAX_POINTS = 200;

function chartPoint(
  candidate: unknown,
  {
    seriesField,
    valueField,
    timeField,
    contextField,
    wanted,
  }: {
    seriesField: string;
    valueField: string;
    timeField: string;
    contextField: string | undefined;
    wanted: string[] | undefined;
  },
) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const row = candidate as Record<string, unknown>;
  const name = resolvePath(row, seriesField);
  const amount = resolvePath(row, valueField);
  const rawTime = resolvePath(row, timeField);
  const rawContext = contextField ? resolvePath(row, contextField) : undefined;
  if (
    (typeof name !== "string" && typeof name !== "number") ||
    typeof amount !== "number"
  ) {
    return null;
  }
  const symbol = String(name);
  if (!symbol || (wanted?.length && !wanted.includes(symbol))) {
    return null;
  }
  const time = rawTime ? new Date(String(rawTime)).getTime() : Date.now();
  if (!Number.isFinite(time) || !Number.isFinite(amount)) {
    return null;
  }
  return {
    symbol,
    point: {
      time,
      price: amount,
      ...(rawContext === undefined || rawContext === null
        ? {}
        : { context: String(rawContext) }),
    },
  };
}

export function LineChartRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<LineChartWidget>) {
  const maxPoints = widget.maxPoints ?? DEFAULT_MAX_POINTS;
  const [series, setSeries] = useState<Record<string, SeriesPoint[]>>({});
  const value = useNotificationValue(boardContext, widget.source);
  const seriesField = widget.seriesField ?? "symbol";
  const valueField = widget.valueField ?? "price";
  const timeField = widget.timeField ?? "time";

  useEffect(() => {
    if (value === undefined) {
      return;
    }

    // An array is a service reporting the whole history as it now stands — a
    // SQL query after an insert, for example. One object remains the original
    // streaming contract and is appended to what the chart already holds.
    if (Array.isArray(value)) {
      const next: Record<string, SeriesPoint[]> = {};
      for (const candidate of value) {
        const parsed = chartPoint(candidate, {
          seriesField,
          valueField,
          timeField,
          contextField: widget.contextField,
          wanted: widget.symbol ? [widget.symbol] : widget.symbols,
        });
        if (!parsed) {
          continue;
        }
        (next[parsed.symbol] ??= []).push(parsed.point);
      }
      for (const symbol of Object.keys(next)) {
        next[symbol] = next[symbol]
          .sort((a, b) => a.time - b.time)
          .slice(-maxPoints);
      }
      setSeries(next);
      return;
    }

    const parsed = chartPoint(value, {
      seriesField,
      valueField,
      timeField,
      contextField: widget.contextField,
      wanted: widget.symbol ? [widget.symbol] : widget.symbols,
    });
    if (!parsed) {
      return;
    }
    setSeries((prev) => {
      const existing = prev[parsed.symbol] ?? [];
      const next = [...existing, parsed.point];
      return {
        ...prev,
        [parsed.symbol]:
          next.length > maxPoints ? next.slice(-maxPoints) : next,
      };
    });
  }, [
    value,
    maxPoints,
    widget.symbol,
    widget.symbols,
    seriesField,
    valueField,
    timeField,
    widget.contextField,
  ]);

  return (
    <LineChart
      series={series}
      height={widget.height}
      width={widget.width}
      normalize={widget.normalize}
      unit={widget.unit}
      contextLabel={widget.contextLabel}
      emptyLabel={widget.emptyLabel}
    />
  );
}
