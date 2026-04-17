type Props = {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  // When provided, a line is drawn at this position and the fill changes
  // colour above the threshold.
  threshold?: number;
  height?: number;
  width?: number;
};

/**
 * Vertical bar-style level meter. Pure display component — no subscriptions.
 * Callers are responsible for feeding live values via the `value` prop.
 *
 * Designed to sit beside a Knob for monitoring contexts (e.g. microphone level).
 */
export default function LevelMeter({
  value,
  min = -60,
  max = 0,
  unit = "dB",
  threshold,
  height = 160,
  width = 28,
}: Props) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const normalized = (clamp(value) - min) / (max - min); // 0=silent, 1=loud
  const thresholdNorm =
    threshold !== undefined ? (clamp(threshold) - min) / (max - min) : null;

  const isAbove = threshold !== undefined && value > threshold;

  // Threshold line y position from top of the bar (0 = top / loudest).
  const thresholdTopPct =
    thresholdNorm !== null ? (1 - thresholdNorm) * 100 : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        userSelect: "none",
        // Fixed width prevents the container from resizing as the numeric
        // readout changes between e.g. "-60 dB" and "-9 dB".
        width: Math.max(width + 4, 56),
      }}
    >
      {/* Bar */}
      <div
        style={{
          position: "relative",
          width,
          height,
          borderRadius: 6,
          background: "hsl(var(--muted))",
          overflow: "visible",
        }}
      >
        {/* Fill — grows upward from bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${normalized * 100}%`,
            borderRadius: 6,
            background: isAbove
              ? "hsl(22, 95%, 55%)"
              : "hsl(var(--primary))",
            opacity: 0.85,
            transition: "height 0.07s ease-out, background 0.18s ease",
          }}
        />

        {/* Threshold line — extends slightly outside the bar for visibility */}
        {thresholdTopPct !== null && (
          <div
            style={{
              position: "absolute",
              left: -5,
              right: -5,
              top: `${thresholdTopPct}%`,
              height: 2,
              background: "hsl(0, 78%, 55%)",
              borderRadius: 1,
              boxShadow: "0 0 4px hsl(0, 78%, 55%, 0.5)",
            }}
          />
        )}

        {/* Min/max labels along the side */}
        <span
          style={{
            position: "absolute",
            top: -16,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 9,
            fontFamily: "monospace",
            color: "hsl(var(--muted-foreground))",
            opacity: 0.6,
          }}
        >
          {max}
        </span>
        <span
          style={{
            position: "absolute",
            bottom: -16,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 9,
            fontFamily: "monospace",
            color: "hsl(var(--muted-foreground))",
            opacity: 0.6,
          }}
        >
          {min}
        </span>
      </div>

      {/* Numeric readout */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: isAbove
            ? "hsl(22, 95%, 50%)"
            : "hsl(var(--muted-foreground))",
          marginTop: 10,
          transition: "color 0.18s ease",
          letterSpacing: "-0.02em",
        }}
      >
        {Number.isFinite(value) ? Math.round(value) : "—"}
        {unit && (
          <span style={{ opacity: 0.6, marginLeft: 2, fontSize: 9 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
