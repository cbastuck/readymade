import { useRef, useCallback } from "react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  label?: string;
  onChange: (value: number) => void;
};

// 270° arc: starts at 225° (7 o'clock), ends at 315° clockwise (5 o'clock)
const START_ANGLE = 225; // degrees
const SWEEP = 270;       // degrees

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export default function Knob({
  value,
  min = 0,
  max = 1,
  size = 48,
  label,
  onChange,
}: Props) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const normalized = (clamp(value) - min) / (max - min); // 0–1

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const strokeW = size * 0.08;
  const dotR = size * 0.06;

  const valueAngle = START_ANGLE + normalized * SWEEP;
  const dotPos = polarToXY(cx, cy, r, valueAngle);

  const trackPath = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP);
  // Only draw value arc when there's a non-zero value to avoid SVG arc edge case at 0
  const valueArcPath = normalized > 0.001
    ? describeArc(cx, cy, r, START_ANGLE, valueAngle)
    : null;

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

  return (
    <div
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, userSelect: "none" }}
    >
      <svg
        width={size}
        height={size}
        style={{ cursor: "ns-resize", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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
