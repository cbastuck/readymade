import { useRef, useCallback, useEffect } from "react";

type Marker = {
  value: number;
  // Text to show; use "\n" to split across two lines.
  text: string;
};

type Props = {
  value: number;
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  label?: string;
  markers?: Marker[];
  onChange: (value: number) => void;
};

// 270° arc: starts at 225° (7 o'clock), ends at 315° clockwise (5 o'clock)
const START_ANGLE = 225; // degrees
const SWEEP = 270; // degrees

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

// Returns SVG text-anchor based on where a point sits around the circle.
// angleDeg uses the same convention as polarToXY: 0=top, 90=right, 180=bottom, 270=left.
function textAnchorForAngle(angleDeg: number): "start" | "middle" | "end" {
  const norm = ((angleDeg % 360) + 360) % 360;
  // near top or near bottom → centre-aligned
  if (norm < 22.5 || norm > 337.5 || (norm > 157.5 && norm < 202.5)) {
    return "middle";
  }
  // right half (0-180 in this coord system) → start; left half → end
  return norm < 180 ? "start" : "end";
}

export default function Knob({
  value,
  min = 0,
  max = 1,
  width = 100,
  height = 100,
  label,
  markers,
  onChange,
}: Props) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const hitRef = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep a ref to value so the wheel handler doesn't go stale between renders.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Wheel listener lives on the outer div — SVG circle elements with transparent
    // fills don't reliably receive wheel events due to SVG hit-test rules.
    // stopPropagation prevents any overflow-scroll container behind the knob from
    // also scrolling while the user is adjusting the value.
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const handler = (e: WheelEvent) => {
      // Hit-test against the knob arc circle so the surrounding marker/label
      // area doesn't swallow scroll events.
      const circle = hitRef.current;
      if (circle) {
        const rect = circle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const r = rect.width / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        if (dx * dx + dy * dy > r * r) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      const range = max - min;
      // deltaMode 1 = line units; normalise to ~pixel equivalent
      const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // 200px of scroll covers the full range; up (negative deltaY) increases value
      const delta = (pixels / 200) * range;
      onChange(Math.max(min, Math.min(max, valueRef.current + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [min, max, onChange]);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const normalized = (clamp(value) - min) / (max - min); // 0–1

  // Arc proportions are based on the smaller dimension so the arc stays circular.
  // The larger dimension gives extra room — useful for marker labels on wider knobs.
  const size = Math.min(width, height);
  // Top/side padding reserves room for marker labels (labels reach ~labelR from centre).
  // Bottom padding can be much smaller: the 270° arc gap sits at the bottom, so no
  // labels ever appear in the bottom-centre region. Max downward label extent is
  // labelR × sin(45°) ≈ 1.22r, which works out to roughly size × 0.28.
  const pad = markers && markers.length > 0 ? size * 0.85 : 0;
  const padBottom = markers && markers.length > 0 ? size * 0.3 : 0;
  const svgW = width + pad * 2;
  const svgH = height + pad + padBottom;
  const cx = svgW / 2;
  // cy stays at the same position as with symmetric padding (pad + height/2).
  const cy = pad + height / 2;
  const r = size * 0.36;
  const strokeW = size * 0.08;
  const dotR = size * 0.06;

  const valueAngle = START_ANGLE + normalized * SWEEP;
  const dotPos = polarToXY(cx, cy, r, valueAngle);

  const trackPath = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP);
  // Only draw value arc when there's a non-zero value to avoid SVG arc edge case at 0
  const valueArcPath =
    normalized > 0.001 ? describeArc(cx, cy, r, START_ANGLE, valueAngle) : null;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startValue: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY; // up = positive
      const range = max - min;
      const delta = (dy / 100) * range;
      onChange(clamp(dragRef.current.startValue + delta));
    },
    [min, max, onChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const labelFontSize = size * 0.11;
  const labelR = r * 1.72;

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        userSelect: "none",
      }}
    >
      <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
        {/* Track arc */}
        <path
          d={trackPath}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valueArcPath && (
          <path
            d={valueArcPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        )}

        {/* Indicator dot */}
        <circle
          cx={dotPos.x}
          cy={dotPos.y}
          r={dotR}
          fill="hsl(var(--primary))"
        />

        {/* Transparent hit area — pointer and wheel events are scoped to the arc zone */}
        <circle
          ref={hitRef}
          cx={cx}
          cy={cy}
          r={r + strokeW * 1.5}
          fill="transparent"
          style={{ cursor: "ns-resize", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* Marker ticks + labels */}
        {markers?.map((marker, i) => {
          const t = (marker.value - min) / (max - min);
          const angle = START_ANGLE + t * SWEEP;
          const tickInner = polarToXY(cx, cy, r + strokeW * 0.8, angle);
          const tickOuter = polarToXY(cx, cy, r + strokeW * 2.2, angle);
          const labelPos = polarToXY(cx, cy, labelR, angle);
          const anchor = textAnchorForAngle(angle);
          const lines = marker.text.split("\n");
          return (
            <g key={i}>
              {/* Tick mark */}
              <line
                x1={tickInner.x}
                y1={tickInner.y}
                x2={tickOuter.x}
                y2={tickOuter.y}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={strokeW * 0.5}
                strokeLinecap="round"
                opacity={0.5}
              />
              {/* Label text — y is set on the <text> so tspan dy offsets are
                  relative to the computed label position, not the SVG origin */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={labelFontSize}
                fill="hsl(var(--muted-foreground))"
                style={{ userSelect: "none" }}
              >
                {lines.map((line, j) => (
                  <tspan
                    key={j}
                    x={labelPos.x}
                    dy={j === 0 ? `${-(lines.length - 1) * 0.5}em` : "1em"}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      {label !== undefined && (
        <span
          style={{
            fontSize: size * 0.22,
            fontFamily: "monospace",
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
