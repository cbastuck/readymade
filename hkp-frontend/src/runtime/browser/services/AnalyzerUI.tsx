import { useEffect, useRef, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";

export default function AnalyzerUI(props: ServiceUIProps) {
  type Modes = "spectogram-v" | "bars" | "spectogram-h";
  const initialWidth = 400;
  const initialHeight = 350;
  const [data, setData] = useState<Array<number>>([]);
  const [mode, setMode] = useState<Modes>("spectogram-h");

  const update = (state: any) => {
    const { onProcess } = state;

    if (needsUpdate(state.mode, mode)) {
      setMode(state.mode);
    }

    if (onProcess !== undefined) {
      setData(onProcess);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const onNotification = (notficiation: any) => update(notficiation);
  const onInit = (state: any) => update(state);
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: initialWidth, height: initialHeight }}
    >
      <div className="flex flex-col justify-between items-center mb-2 w-full h-full">
        <div className="h-10 items-left flex gap-2 w-full">
          <div>Mode:</div>
          <Select
            className="capitalize w-full"
            value={mode}
            onChange={(e) => setMode(e as Modes)}
            options={["spectogram-h", "spectogram-v", "bars"]}
          />
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: "calc(100% - 30px)" }}
        >
          {mode === "bars" && <SvgBars data={data} />}
          {mode === "spectogram-h" && <Spectrogram data={data} />}
          {mode === "spectogram-v" && <VerticalSpectrogram data={data} />}
        </div>
      </div>
    </ServiceUI>
  );
}

function Spectrogram({ data = [] }: { data?: Array<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 200;
  const height = 100;
  const maxValue = 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Scroll the canvas to the right by 1 pixel
    const imageData = ctx.getImageData(0, 0, width - 1, height);
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 1, 0);

    const useLogScale = true; // Use logarithmic scaling for intensity
    // Draw new FFT data in the first column (x = 0)
    for (let y = 0; y < height; y++) {
      // Map y to data index
      const dataIdx = Math.floor((y / height) * data.length);
      const value = data[dataIdx] ?? 0;
      const intensity = useLogScale
        ? Math.min(
            255,
            Math.floor((Math.log10(value + 1) / Math.log10(maxValue + 1)) * 255)
          )
        : Math.min(255, Math.floor((value / maxValue) * 255));

      ctx.fillStyle = `rgb(${intensity},${intensity},${255})`;
      ctx.fillRect(0, height - y - 1, 1, 1);
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

/**
 * VerticalSpectrogram that scrolls from bottom to top.
 * The newest data appears at the bottom row (y = height - 1).
 */
function VerticalSpectrogram({ data = [] }: { data?: Array<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 200;
  const height = 100;
  const maxValue = 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Scroll the canvas up by 1 pixel (move everything 1px up)
    const imageData = ctx.getImageData(0, 1, width, height - 1);
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);

    const useLogScale = true; // Use logarithmic scaling for intensity
    // Draw new FFT data in the last row (y = height - 1)
    for (let x = 0; x < width; x++) {
      // Map x to data index
      const dataIdx = Math.floor((x / width) * data.length);
      const value = data[dataIdx] ?? 0;
      const intensity = useLogScale
        ? Math.min(
            255,
            Math.floor((Math.log10(value + 1) / Math.log10(maxValue + 1)) * 255)
          )
        : Math.min(255, Math.floor((value / maxValue) * 255));

      ctx.fillStyle = `rgb(${intensity},${intensity},${255})`;
      ctx.fillRect(x, height - 1, 1, 1);
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

function SvgBars({ data = [] }: { data?: Array<number> }) {
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
