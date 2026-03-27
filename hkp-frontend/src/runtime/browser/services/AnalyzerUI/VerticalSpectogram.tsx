import { useEffect, useRef } from "react";

type Props = { data?: Array<number> };

/**
 * VerticalSpectrogram that scrolls from bottom to top.
 * The newest data appears at the bottom row (y = height - 1).
 */
export default function VerticalSpectrogram({ data = [] }: Props) {
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
