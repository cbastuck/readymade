import React, { useEffect, useState } from "react";
import { HeatmapWidget } from "../../types";
import { useNotificationValue } from "./StatusIndicatorRenderer";
import { WidgetRendererProps } from "../widgetRegistry";

export type NormalizedHeatmap = {
  matrices: number[][][];
  rowLabels: string[];
  colLabels: string[];
  preferredSlice?: number;
  disabledSlices?: number[];
  subtitle?: string;
};

function is2DMatrix(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    typeof value[0][0] === "number"
  );
}

function is3DMatrix(value: unknown): value is number[][][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    is2DMatrix(value[0])
  );
}

function toStringLabels(value: unknown, count: number): string[] {
  if (Array.isArray(value) && value.length > 0) {
    return value.slice(0, count).map((item) => String(item));
  }
  return Array.from({ length: count }, (_, idx) => String(idx));
}

export function normalizeHeatmapValue(
  value: unknown,
  externalLabels?: unknown,
): NormalizedHeatmap | null {
  if (is2DMatrix(value)) {
    const rows = value.length;
    const cols = value[0]?.length ?? 0;
    return {
      matrices: [value],
      rowLabels: toStringLabels(externalLabels, rows),
      colLabels: toStringLabels(externalLabels, cols),
    };
  }
  if (is3DMatrix(value)) {
    const rows = value[0].length;
    const cols = value[0][0]?.length ?? 0;
    return {
      matrices: value,
      rowLabels: toStringLabels(externalLabels, rows),
      colLabels: toStringLabels(externalLabels, cols),
    };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const patterns = record.patterns ?? record.slices;
    const single = record.matrix ?? record.pattern;
    let matrices: number[][][] | null = null;
    if (is3DMatrix(patterns)) {
      matrices = patterns;
    } else if (is2DMatrix(single)) {
      matrices = [single];
    }
    if (!matrices || matrices.length === 0) {
      return null;
    }
    const rows = matrices[0].length;
    const cols = matrices[0][0]?.length ?? 0;
    const sharedLabels = record.pieces ?? record.labels ?? externalLabels;
    const rowLabels = toStringLabels(record.rows ?? sharedLabels, rows);
    const colLabels = toStringLabels(record.columns ?? sharedLabels, cols);
    const preferredSlice =
      typeof record.head === "number"
        ? record.head
        : typeof record.slice === "number"
          ? record.slice
          : undefined;
    const disabledSlices = Array.isArray(record.disabledHeads)
      ? record.disabledHeads.filter((h): h is number => typeof h === "number")
      : undefined;
    const parts: string[] = [];
    if (typeof record.layer === "number") {
      parts.push(`layer ${record.layer}`);
    }
    if (typeof record.mask === "string") {
      parts.push(
        record.mask === "window" && typeof record.window === "number"
          ? `window ${record.window}`
          : record.mask,
      );
    }
    if (typeof record.temperature === "number" && record.temperature !== 1) {
      parts.push(`temp ${record.temperature}`);
    }
    return {
      matrices,
      rowLabels,
      colLabels,
      preferredSlice,
      disabledSlices,
      subtitle: parts.length > 0 ? parts.join(" · ") : undefined,
    };
  }
  return null;
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `${r}, ${g}, ${b}`;
    }
  }
  return "59, 130, 246";
}

export function HeatmapMatrixView({
  data,
  label,
  rowAxis,
  columnAxis,
  color = "#3b82f6",
  min: fixedMin,
  max: fixedMax,
  showValues = false,
  cellSize = 26,
  selectedSlice: controlledSlice,
  onSelectSlice,
  onToggleSliceDisabled,
}: {
  data: NormalizedHeatmap;
  label?: string;
  rowAxis?: string;
  columnAxis?: string;
  color?: string;
  min?: number;
  max?: number;
  showValues?: boolean;
  cellSize?: number;
  selectedSlice?: number;
  onSelectSlice?: (slice: number) => void;
  onToggleSliceDisabled?: (slice: number) => void;
}) {
  const [internalSlice, setInternalSlice] = useState<number>(
    data.preferredSlice ?? 0,
  );
  const [hovered, setHovered] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);

  useEffect(() => {
    if (typeof data.preferredSlice === "number") {
      setInternalSlice(data.preferredSlice);
    }
  }, [data.preferredSlice]);

  const activeSlice = Math.min(
    Math.max(controlledSlice ?? internalSlice, 0),
    data.matrices.length - 1,
  );
  const matrix = data.matrices[activeSlice] ?? [];
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  let minVal = fixedMin ?? Infinity;
  let maxVal = fixedMax ?? -Infinity;
  if (fixedMin === undefined || fixedMax === undefined) {
    for (const row of matrix) {
      for (const cell of row) {
        if (Number.isFinite(cell)) {
          if (fixedMin === undefined && cell < minVal) minVal = cell;
          if (fixedMax === undefined && cell > maxVal) maxVal = cell;
        }
      }
    }
    if (!Number.isFinite(minVal)) minVal = 0;
    if (!Number.isFinite(maxVal)) maxVal = 1;
    if (fixedMin === undefined && minVal >= 0 && maxVal <= 1) {
      minVal = 0;
      if (fixedMax === undefined) maxVal = 1;
    }
  }
  const span = maxVal > minVal ? maxVal - minVal : 1;
  const rgb = hexToRgb(color);
  const disabledSet = new Set(data.disabledSlices ?? []);

  const pickSlice = (idx: number) => {
    setInternalSlice(idx);
    onSelectSlice?.(idx);
  };

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="heatmap-widget"
      style={{ fontSize: 12 }}
    >
      {(label || data.subtitle || data.matrices.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {label && <span className="font-medium">{label}</span>}
            {data.subtitle && (
              <span className="opacity-60 font-mono text-xs">
                {data.subtitle}
              </span>
            )}
          </div>
          {data.matrices.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="tablist"
              aria-label="Matrix slice"
            >
              <span className="opacity-60 text-xs mr-1">Head</span>
              {data.matrices.map((_, idx) => {
                const isSelected = idx === activeSlice;
                const isDisabled = disabledSet.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => pickSlice(idx)}
                    onDoubleClick={
                      onToggleSliceDisabled
                        ? () => onToggleSliceDisabled(idx)
                        : undefined
                    }
                    title={
                      isDisabled
                        ? `Head ${idx} (switched off)`
                        : `Show head ${idx}`
                    }
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                      border: isSelected
                        ? `1px solid ${color}`
                        : "1px solid rgba(128,128,128,0.3)",
                      background: isSelected
                        ? `rgba(${rgb}, 0.22)`
                        : "transparent",
                      textDecoration: isDisabled ? "line-through" : undefined,
                      opacity: isDisabled ? 0.45 : 1,
                      cursor: "pointer",
                    }}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <div
          style={{
            display: "inline-grid",
            gridTemplateColumns: ` minmax(56px, auto) repeat(${cols}, ${cellSize}px)`,
            gap: 2,
            alignItems: "center",
          }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Top-left corner */}
          <div
            className="text-right pr-2 opacity-50 font-mono"
            style={{ fontSize: 10 }}
          >
            {rowAxis && columnAxis ? `${rowAxis} \\ ${columnAxis}` : ""}
          </div>
          {/* Column headers */}
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={`col-${c}`}
              className="font-mono truncate text-center opacity-75"
              title={data.colLabels[c] ?? String(c)}
              style={{
                fontSize: 10,
                width: cellSize,
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                maxHeight: 68,
                padding: "2px 0",
              }}
            >
              {data.colLabels[c] ?? c}
            </div>
          ))}

          {/* Rows */}
          {matrix.map((row, r) => (
            <React.Fragment key={`row-${r}`}>
              <div
                className="font-mono truncate text-right pr-2 opacity-80"
                title={data.rowLabels[r] ?? String(r)}
                style={{ fontSize: 11, maxWidth: 96 }}
              >
                {data.rowLabels[r] ?? r}
              </div>
              {row.map((val, c) => {
                const norm = Number.isFinite(val)
                  ? Math.min(Math.max((val - minVal) / span, 0), 1)
                  : 0;
                const isHovered =
                  hovered?.row === r && hovered?.col === c;
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    data-testid={`heatmap-cell-${r}-${c}`}
                    onMouseEnter={() =>
                      setHovered({ row: r, col: c, value: val })
                    }
                    title={`${JSON.stringify(data.rowLabels[r] ?? r)} → ${JSON.stringify(
                      data.colLabels[c] ?? c,
                    )}: ${Number.isFinite(val) ? val.toFixed(3) : "—"}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 3,
                      background: `rgba(${rgb}, ${(0.06 + norm * 0.88).toFixed(3)})`,
                      border: isHovered
                        ? `1px solid ${color}`
                        : "1px solid rgba(128,128,128,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontFamily: "monospace",
                      color: norm > 0.55 ? "#ffffff" : "inherit",
                      userSelect: "none",
                    }}
                  >
                    {showValues && Number.isFinite(val)
                      ? val.toFixed(2).replace(/^0\./, ".")
                      : ""}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div
        className="font-mono opacity-75"
        style={{ fontSize: 11, minHeight: 16 }}
        data-testid="heatmap-readout"
      >
        {hovered
          ? `${JSON.stringify(data.rowLabels[hovered.row] ?? hovered.row)} → ${JSON.stringify(
              data.colLabels[hovered.col] ?? hovered.col,
            )}: ${hovered.value.toFixed(4)}`
          : "Hover a cell to read its weight."}
      </div>
    </div>
  );
}

export function HeatmapRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<HeatmapWidget>) {
  const raw = useNotificationValue(boardContext, widget.source);
  const externalLabels = useNotificationValue(boardContext, widget.labelsSource);
  const data = normalizeHeatmapValue(raw, externalLabels);

  if (!data) {
    return (
      <div
        className="opacity-60 text-sm py-2"
        data-testid="heatmap-placeholder"
      >
        {widget.placeholder ?? "Waiting for matrix data…"}
      </div>
    );
  }

  return (
    <HeatmapMatrixView
      data={data}
      label={widget.label}
      rowAxis={widget.rowAxis}
      columnAxis={widget.columnAxis}
      color={widget.color}
      min={widget.min}
      max={widget.max}
      showValues={widget.showValues}
      cellSize={widget.cellSize}
    />
  );
}
