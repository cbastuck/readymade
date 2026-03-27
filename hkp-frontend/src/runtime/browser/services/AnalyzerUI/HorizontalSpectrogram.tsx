import { useEffect, useRef } from "react";

type Props = { data?: Array<number> };

export default function HorizontalSpectrogram({ data = [] }: Props) {
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
      const n = data.length;
      const dataIdx = Math.floor((y / height) * n);
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
