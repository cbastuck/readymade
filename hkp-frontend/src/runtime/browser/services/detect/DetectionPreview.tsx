import { useEffect, useRef } from "react";

import type { Face } from "../Detect";

/** What Detect reports on each frame as `found`: the frame, and what was in it. */
export type Found = {
  faces: Face[];
  frame: { width: number; height: number };
  image: Blob | null;
};

/**
 * The last frame Detect looked at, with what it found outlined. Drawn by the
 * service's panel and by the facade's `detect` widget, from the same `found`
 * notification.
 */
export default function DetectionPreview({
  found,
  width,
}: {
  found: Found;
  width: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { frame, faces, image } = found;
  const scale = frame.width ? width / frame.width : 1;
  const height = Math.round(frame.height * scale) || 1;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    let cancelled = false;
    const draw = (bitmap: ImageBitmap | null) => {
      if (cancelled) {
        bitmap?.close();
        return;
      }
      ctx.clearRect(0, 0, width, height);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#22c55e";
      for (const face of faces) {
        ctx.strokeRect(
          face.box.x * scale,
          face.box.y * scale,
          face.box.width * scale,
          face.box.height * scale,
        );
      }
    };
    if (image) {
      createImageBitmap(image).then(draw, () => draw(null));
    } else {
      draw(null);
    }
    return () => {
      cancelled = true;
    };
  }, [width, height, scale, faces, image]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`${faces.length} ${faces.length === 1 ? "face" : "faces"} found`}
      width={width}
      height={height}
      style={{ width, height, background: "#111", borderRadius: 6 }}
    />
  );
}
