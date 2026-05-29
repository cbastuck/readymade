import { useRef, useState, useEffect, useMemo } from "react";

export type SeriesPoint = { time: number; price: number };

type Props = {
  series: Record<string, SeriesPoint[]>;
  height?: number;
  width?: number;
  // Show each series as % change from its first price.
  // Required when multiple symbols at different price levels share one chart.
  normalize?: boolean;
};

const PALETTE = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#06b6d4",
];
const PAD = { left: 56, right: 90, top: 14, bottom: 30 };
const GRID_LINES = 4;
// Starting symmetric range for normalized mode (±%). Only ever expands.
const PCT_FLOOR = 0.5;

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

export default function LineChart({
  series,
  height = 200,
  width: width_ = 600,
  normalize = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(width_);

  // Expand-only Y bounds for normalized mode — prevents axis jumping.
  const [normPMin, setNormPMin] = useState(-PCT_FLOOR);
  const [normPMax, setNormPMax] = useState(PCT_FLOOR);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset normalized bounds when switching modes.
  useEffect(() => {
    setNormPMin(-PCT_FLOOR);
    setNormPMax(PCT_FLOOR);
  }, [normalize]);

  const activeSeries = useMemo(() => {
    if (!normalize) {
      return series;
    }
    const out: Record<string, SeriesPoint[]> = {};
    for (const [sym, pts] of Object.entries(series)) {
      if (pts.length === 0) {
        out[sym] = [];
        continue;
      }
      const base = pts[0].price;
      out[sym] = pts.map((p) => ({
        time: p.time,
        price: base > 0 ? (p.price / base - 1) * 100 : 0,
      }));
    }
    return out;
  }, [series, normalize]);

  // Expand normalized Y bounds when data exceeds them.
  useEffect(() => {
    if (!normalize) {
      return;
    }
    const allValues = Object.values(activeSeries).flatMap((pts) =>
      pts.map((p) => p.price),
    );
    if (allValues.length === 0) {
      return;
    }
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    setNormPMin((prev) => Math.min(prev, dataMin * 1.1));
    setNormPMax((prev) => Math.max(prev, dataMax * 1.1));
  }, [activeSeries, normalize]);

  const symbols = Object.keys(activeSeries);
  const allPoints = symbols.flatMap((s) => activeSeries[s]);
  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;
  const empty = allPoints.length === 0;

  // For non-normalized: derive bounds from data directly (tight, per-symbol scale).
  let pMin: number;
  let pMax: number;
  if (normalize) {
    pMin = normPMin;
    pMax = normPMax;
  } else if (empty) {
    pMin = 0;
    pMax = 1;
  } else {
    const vals = allPoints.map((p) => p.price);
    const dMin = Math.min(...vals);
    const dMax = Math.max(...vals);
    const pad = (dMax - dMin) * 0.15 || dMin * 0.002 || 0.5;
    pMin = dMin - pad;
    pMax = dMax + pad;
  }

  const tMin = empty ? 0 : Math.min(...allPoints.map((p) => p.time));
  const tMax = empty ? 1 : Math.max(...allPoints.map((p) => p.time));
  const tRange = tMax === tMin ? 1 : tMax - tMin;
  const pRange = pMax === pMin ? 1 : pMax - pMin;

  const xOf = (t: number) => PAD.left + ((t - tMin) / tRange) * chartW;
  const yOf = (p: number) => PAD.top + (1 - (p - pMin) / pRange) * chartH;

  const yTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const v = pMin + (i / GRID_LINES) * pRange;
    return { v, y: yOf(v) };
  });

  const xTicks = Array.from({ length: 4 }, (_, i) => {
    const t = tMin + (i / 3) * tRange;
    return { t, x: xOf(t) };
  });

  const zeroY = normalize ? yOf(0) : null;

  return (
    <div ref={containerRef} style={{ width, height }}>
      {empty ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "hsl(var(--muted-foreground))",
            fontFamily: "monospace",
          }}
        >
          Waiting for data…
        </div>
      ) : (
        <svg width={width} height={height} style={{ display: "block" }}>
          {/* Y grid + labels */}
          {yTicks.map(({ v, y }, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
                fontFamily="monospace"
              >
                {normalize
                  ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
                  : v.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Dashed baseline for normalized mode */}
          {zeroY !== null && (
            <line
              x1={PAD.left}
              y1={zeroY}
              x2={PAD.left + chartW}
              y2={zeroY}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.45}
            />
          )}

          {/* X-axis time labels */}
          {xTicks.map(({ t, x }, i) => (
            <text
              key={i}
              x={x}
              y={PAD.top + chartH + 18}
              textAnchor="middle"
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
            >
              {fmtTime(t)}
            </text>
          ))}

          {/* Chart border */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={chartW}
            height={chartH}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />

          {/* Series */}
          {symbols.map((sym, idx) => {
            const pts = activeSeries[sym];
            if (pts.length < 2) {
              return null;
            }
            const color = PALETTE[idx % PALETTE.length];
            const polyPoints = pts
              .map((p) => `${xOf(p.time)},${yOf(p.price)}`)
              .join(" ");
            const last = pts[pts.length - 1];
            const origLast = series[sym]?.[series[sym].length - 1];

            return (
              <g key={sym}>
                <polyline
                  points={polyPoints}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Symbol + latest absolute price at line end */}
                <text
                  x={PAD.left + chartW + 6}
                  y={yOf(last.price)}
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={color}
                  fontFamily="monospace"
                >
                  {sym} {origLast ? origLast.price.toFixed(2) : ""}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
