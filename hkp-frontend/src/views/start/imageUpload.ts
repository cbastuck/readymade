/**
 * Downscales an image file in the browser before upload, so the servers only
 * ever store small tiles (rendered at 38–84px) and need no image processing.
 */
export async function downscaleImage(
  file: File | Blob,
  maxDimension = 512,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Could not encode image")),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
