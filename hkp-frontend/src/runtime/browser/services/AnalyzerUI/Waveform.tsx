import { Data, isFloatRingBuffer } from "hkp-frontend/src/runtime/rest/Data";
import { useMemo, useState } from "react";

type Props = { data?: Data };

export default function Waveform({ data }: Props) {
  const [useFloatInterpretation, setUseFloatInterpretation] = useState(true);
  const [littleEndian, setLittleEndian] = useState(true);

  // Generate path for waveform
  const generatePath = (
    data: Uint8Array,
    asFloat: boolean,
    isLittleEndian: boolean,
  ): string => {
    if (!data || data.length === 0) {
      return "";
    }

    const points: Array<{ x: number; y: number }> = [];

    if (asFloat) {
      // Interpret as Float32Array
      const buffer = data.buffer;
      const byteOffset = data.byteOffset;
      const length = data.length / 4; // Number of 32-bit floats

      const dataView = new DataView(buffer, byteOffset);

      for (let idx = 0; idx < length; idx++) {
        const value = dataView.getFloat32(idx * 4, isLittleEndian);
        const x = (idx / (length - 1)) * 100;
        // For waveform, normalize around center (50)
        const normalizedValue = ((value + 1) / 2) * 100; // Assumes -1 to 1 range
        const y = 100 - Math.max(0, Math.min(100, normalizedValue));
        points.push({ x, y });
      }
    } else {
      // Interpret as Uint8Array
      for (let idx = 0; idx < data.length; idx++) {
        const value = data[idx];
        const x = (idx / (data.length - 1)) * 100;
        const normalizedValue = (value / 255) * 100;
        const y = 100 - normalizedValue;
        points.push({ x, y });
      }
    }

    if (points.length === 0) {
      return "";
    }

    // Create smooth path using the points
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  const pathData = useMemo(() => {
    if (!data || !isFloatRingBuffer(data)) {
      return "";
    }
    return generatePath(data.array, useFloatInterpretation, littleEndian);
  }, [data, useFloatInterpretation, littleEndian]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex gap-4 mb-2 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={useFloatInterpretation}
            onChange={(e) => setUseFloatInterpretation(e.target.checked)}
          />
          Float32
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={littleEndian}
            onChange={(e) => setLittleEndian(e.target.checked)}
            disabled={!useFloatInterpretation}
          />
          Little Endian
        </label>
      </div>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 100 100`}
        preserveAspectRatio="none"
      >
        {data && isFloatRingBuffer(data) && data.array.length > 0 && (
          <path
            d={pathData}
            fill="none"
            stroke="#4a90e2"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
