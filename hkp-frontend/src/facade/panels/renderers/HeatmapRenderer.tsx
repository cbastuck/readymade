import React, { useEffect, useState } from "react";
import { HeatmapWidget } from "../../types";
import { useNotificationValue } from "./StatusIndicatorRenderer";
import { WidgetRendererProps } from "../widgetRegistry";

/**
 * A matrix of numbers as a grid of cells, darker the larger. It knows nothing
 * of what the numbers are — an attention pattern, a confusion matrix, a
 * correlation table: what they mean is said by the widgets around it.
 */
export type NormalizedHeatmap = {
  /** One matrix, or several of the same shape to switch between. */
  matrices: number[][][];
  rowLabels: string[];
  colLabels: string[];
  /** Which of several matrices to show first. */
  preferredSlice?: number;
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
  return Array.isArray(value) && value.length > 0 && is2DMatrix(value[0]);
}

function toStringLabels(value: unknown, count: number): string[] {
  if (Array.isArray(value) && value.length > 0) {
    return value.slice(0, count).map((item) => String(item));
  }
  return Array.from({ length: count }, (_, idx) => String(idx));
}

/**
 * What a source reports, as matrices and labels: a bare `number[][]`, a
 * `number[][][]` of slices, or `{ matrix | slices, rows?, columns?, labels?,
 * slice? }`. Labels come from the value, else from `externalLabels`, else
 * are the indices. Anything else is null.
 */
export function normalizeHeatmapValue(
  value: unknown,
  externalLabels?: unknown,
): NormalizedHeatmap | null {
  let matrices: number[][][] | null = null;
  let record: Record<string, unknown> = {};
  if (is2DMatrix(value)) {
    matrices = [value];
  } else if (is3DMatrix(value)) {
    matrices = value;
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    record = value as Record<string, unknown>;
    if (is3DMatrix(record.slices)) {
      matrices = record.slices;
    } else if (is2DMatrix(record.matrix)) {
      matrices = [record.matrix];
    }
  }
  if (!matrices) {
    return null;
  }
  const rows = matrices[0].length;
  const cols = matrices[0][0]?.length ?? 0;
  const shared = record.labels ?? externalLabels;
  return {
    matrices,
    rowLabels: toStringLabels(record.rows ?? shared, rows),
    colLabels: toStringLabels(record.columns ?? shared, cols),
    preferredSlice:
      typeof record.slice === "number" ? record.slice : undefined,
  };
}

/** A cell's fill: `color` at a strength between faint and full. */
function shade(color: string, strength: number): string {
  const percent = Math.round((0.06 + strength * 0.88) * 100);
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export function HeatmapMatrixView({
  data,
  label,
  rowAxis,
  columnAxis,
  sliceLabel,
  color = "var(--primary)",
  min: fixedMin,
  max: fixedMax,
  showValues = false,
  cellSize = 26,
}: {
  data: NormalizedHeatmap;
  label?: string;
  rowAxis?: string;
  columnAxis?: string;
  sliceLabel?: string;
  color?: string;
  min?: number;
  max?: number;
  showValues?: boolean;
  cellSize?: number;
}) {
  const [slice, setSlice] = useState<number>(data.preferredSlice ?? 0);
  const [hovered, setHovered] = useState<{
    row: number;
    col: number;
    value: number;
  } | null>(null);

  useEffect(() => {
    if (typeof data.preferredSlice === "number") {
      setSlice(data.preferredSlice);
    }
  }, [data.preferredSlice]);

  const activeSlice = Math.min(Math.max(slice, 0), data.matrices.length - 1);
  const matrix = data.matrices[activeSlice] ?? [];
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
    // Numbers between 0 and 1 are read as shares of a whole: on that scale,
    // not stretched to whatever this matrix happens to span.
    if (fixedMin === undefined && minVal >= 0 && maxVal <= 1) {
      minVal = 0;
      if (fixedMax === undefined) maxVal = 1;
    }
  }
  const span = maxVal > minVal ? maxVal - minVal : 1;

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="heatmap-widget"
      style={{ fontSize: 12 }}
    >
      {(label || data.matrices.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {label ? <span className="font-medium">{label}</span> : <span />}
          {data.matrices.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-1"
              role="tablist"
              aria-label={sliceLabel ?? "Matrix"}
            >
              {sliceLabel && (
                <span className="opacity-60 text-xs mr-1">{sliceLabel}</span>
              )}
              {data.matrices.map((_, idx) => {
                const isSelected = idx === activeSlice;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSlice(idx)}
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "var(--font-mono, monospace)",
                      border: `1px solid ${isSelected ? color : "var(--border)"}`,
                      background: isSelected ? shade(color, 0.18) : "transparent",
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
            className="text-right pr-2 font-mono"
            style={{ fontSize: 10, color: "var(--muted-foreground)" }}
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
                const isHovered = hovered?.row === r && hovered?.col === c;
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    data-testid={`heatmap-cell-${r}-${c}`}
                    onMouseEnter={() => setHovered({ row: r, col: c, value: val })}
                    title={`${JSON.stringify(data.rowLabels[r] ?? r)} → ${JSON.stringify(
                      data.colLabels[c] ?? c,
                    )}: ${Number.isFinite(val) ? val.toFixed(3) : "—"}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: 3,
                      background: shade(color, norm),
                      border: `1px solid ${isHovered ? color : "var(--border)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontFamily: "var(--font-mono, monospace)",
                      color: norm > 0.55 ? "var(--primary-foreground)" : "inherit",
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
        className="font-mono"
        style={{ fontSize: 11, minHeight: 16, color: "var(--muted-foreground)" }}
        data-testid="heatmap-readout"
      >
        {hovered
          ? `${JSON.stringify(data.rowLabels[hovered.row] ?? hovered.row)} → ${JSON.stringify(
              data.colLabels[hovered.col] ?? hovered.col,
            )}: ${hovered.value.toFixed(4)}`
          : "Hover a cell to read its value."}
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
        className="text-sm py-2"
        style={{ color: "var(--muted-foreground)" }}
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
      sliceLabel={widget.sliceLabel}
      color={widget.color}
      min={widget.min}
      max={widget.max}
      showValues={widget.showValues}
      cellSize={widget.cellSize}
    />
  );
}
