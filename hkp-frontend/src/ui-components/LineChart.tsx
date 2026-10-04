import {
  useRef,
  useState,
  useEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SeriesPoint = { time: number; price: number; context?: string };

type Props = {
  series: Record<string, SeriesPoint[]>;
  height?: number;
  width?: number;
  // Show each series as % change from its first price.
  // Required when multiple symbols at different price levels share one chart.
  normalize?: boolean;
  unit?: string;
  contextLabel?: string;
  emptyLabel?: string;
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

function fmtTime(ms: number, span: number): string {
  const d = new Date(ms);
  if (span >= 24 * 60 * 60 * 1000) {
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    (span < 60 * 60 * 1000
      ? `:${String(d.getSeconds()).padStart(2, "0")}`
      : "")
  );
}

function fmtHoverTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

function nearestPoint(points: SeriesPoint[], targetTime: number) {
  let nearest = points[0];
  for (const point of points.slice(1)) {
    if (Math.abs(point.time - targetTime) < Math.abs(nearest.time - targetTime)) {
      nearest = point;
    }
  }
  return nearest;
}

export default function LineChart({
  series,
  height = 200,
  width: requestedWidth,
  normalize = false,
  unit,
  contextLabel = "Context",
  emptyLabel = "Waiting for data…",
}: Props) {
  const initialWidth = requestedWidth ?? 600;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

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
        context: p.context,
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
  const longestEndLabel = symbols.reduce((longest, symbol) => {
    const points = series[symbol];
    const latestValue = points?.[points.length - 1]?.price;
    const label = `${symbol}${latestValue === undefined ? "" : ` ${latestValue.toFixed(2)}`}${unit ? ` ${unit}` : ""}`;
    return Math.max(longest, label.length);
  }, 0);
  const rightPad = Math.min(
    180,
    Math.max(PAD.right, longestEndLabel * 6 + 12),
  );
  const chartW = Math.max(80, width - PAD.left - rightPad);
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
  const hovered =
    hoverTime === null
      ? []
      : symbols.flatMap((symbol, index) => {
          const activePoints = activeSeries[symbol];
          const originalPoints = series[symbol] ?? [];
          if (!activePoints.length || !originalPoints.length) {
            return [];
          }
          const point = nearestPoint(activePoints, hoverTime);
          const original = nearestPoint(originalPoints, point.time);
          return [
            {
              symbol,
              point,
              original,
              color: PALETTE[index % PALETTE.length],
            },
          ];
        });
  const hoverX = hoverTime === null ? 0 : xOf(hoverTime);
  const tooltipWidth = 260;
  const tooltipLeft = Math.max(
    4,
    Math.min(width - tooltipWidth - 4, hoverX + 10),
  );

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg || !allPoints.length) {
      return;
    }
    const bounds = svg.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    const pointerX =
      ((event.clientX - bounds.left) / bounds.width) * width;
    const plotX = Math.max(PAD.left, Math.min(PAD.left + chartW, pointerX));
    const targetTime = tMin + ((plotX - PAD.left) / chartW) * tRange;
    setHoverTime(nearestPoint(allPoints, targetTime).time);
  };
  const hoverContexts = [
    ...new Set(
      hovered
        .map(({ original }) => original.context?.trim())
        .filter((context): context is string => !!context),
    ),
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: requestedWidth ?? "100%",
        maxWidth: "100%",
        height,
      }}
    >
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
          {emptyLabel}
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
              {fmtTime(t, tRange)}
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
                  {origLast && unit ? ` ${unit}` : ""}
                </text>
              </g>
            );
          })}

          {/* Pointer surface, crosshair and selected values. */}
          <rect
            data-testid="line-chart-hit-area"
            x={PAD.left}
            y={PAD.top}
            width={chartW}
            height={chartH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={() => setHoverTime(null)}
          />
          {hoverTime !== null && (
            <g pointerEvents="none">
              <line
                x1={hoverX}
                y1={PAD.top}
                x2={hoverX}
                y2={PAD.top + chartH}
                stroke="hsl(var(--foreground))"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              {hovered.map(({ symbol, point, color }) => (
                <circle
                  key={symbol}
                  cx={xOf(point.time)}
                  cy={yOf(point.price)}
                  r={3.5}
                  fill="hsl(var(--background))"
                  stroke={color}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}
      {hoverTime !== null && hovered.length > 0 && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: tooltipLeft,
            top: PAD.top + 6,
            width: tooltipWidth,
            maxWidth: "calc(100% - 8px)",
            padding: "7px 9px",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            boxShadow: "0 4px 12px rgb(0 0 0 / 0.16)",
            fontFamily: "monospace",
            fontSize: 10,
            lineHeight: 1.4,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              marginBottom: 4,
              color: "hsl(var(--muted-foreground))",
              whiteSpace: "nowrap",
            }}
          >
            {fmtHoverTime(hoverTime)}
          </div>
          {hovered.map(({ symbol, original, color }) => (
            <div
              key={symbol}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, overflowWrap: "anywhere" }}>{symbol}</span>
              <span style={{ whiteSpace: "nowrap" }}>
                {original.price.toFixed(2)}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
          ))}
          {hoverContexts.length > 0 && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 5,
                borderTop: "1px solid hsl(var(--border))",
              }}
            >
              <div
                style={{
                  marginBottom: 2,
                  color: "hsl(var(--muted-foreground))",
                  fontWeight: 600,
                }}
              >
                {contextLabel}
              </div>
              {hoverContexts.map((context) => (
                <div
                  key={context}
                  title={context}
                  style={{
                    whiteSpace: "pre-wrap",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {context}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
