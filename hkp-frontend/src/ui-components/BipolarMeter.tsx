type Props = {
  value: number; // [-1, 1]: negative = sell/left, positive = buy/right
  label?: string;
  width?: number;
  height?: number;
};

/**
 * Horizontal bidirectional meter centered at 0.
 * Fills right (green) for positive values, left (red) for negative.
 * Domain is [-1, 1]; values outside are clamped.
 */
export default function BipolarMeter({
  value,
  label,
  width = 160,
  height = 16,
}: Props) {
  const clamped = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const isPositive = clamped >= 0;
  const fillPct = Math.abs(clamped) * 50;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        userSelect: "none",
      }}
    >
      {label !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "hsl(var(--muted-foreground))",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {label}
        </span>
      )}

      <div
        style={{
          position: "relative",
          width,
          height,
          borderRadius: 4,
          background: "hsl(var(--muted))",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Fill — grows from center outward */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            ...(isPositive
              ? { left: "50%", width: `${fillPct}%` }
              : { right: "50%", width: `${fillPct}%` }),
            background: isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 78%, 55%)",
            opacity: 0.85,
            transition: "width 0.12s ease-out",
          }}
        />

        {/* Center divider */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            background: "hsl(var(--muted-foreground))",
            opacity: 0.35,
          }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: "hsl(var(--muted-foreground))",
          minWidth: 36,
        }}
      >
        {clamped >= 0 ? "+" : ""}
        {clamped.toFixed(2)}
      </span>
    </div>
  );
}
