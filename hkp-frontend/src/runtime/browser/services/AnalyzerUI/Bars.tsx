export default function Bars({ data = [] }: { data?: Array<number> }) {
  const maxValue = 2;
  const useLogScale = true;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 100 100`}
      preserveAspectRatio="none"
    >
      {data.length > 0 &&
        data.map((value, idx) => {
          const barHeight = useLogScale
            ? Math.min(
                100,
                (Math.log10(value + 1) / Math.log10(maxValue + 1)) * 100
              )
            : (value / maxValue) * 100;
          const barWidth = 100 / data.length;
          return (
            <rect
              key={idx}
              x={idx * barWidth}
              y={100 - barHeight - 1}
              width={barWidth}
              height={barHeight}
              fill="#4a90e2"
            />
          );
        })}
    </svg>
  );
}
