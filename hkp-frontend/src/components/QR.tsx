import { useRef, useEffect } from "react";

import QRCode from "qrcode";

type Props = {
  url: string;
};

export default function QR({ url = window.location.href }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      QRCode.toCanvas(canvas, url, (error: Error | null | undefined) => {
        if (error) {
          console.error("QR.toCanvas()", error);
        }
      });
    }
  }, [url]);

  return <canvas ref={canvasRef} width="100%" height="100%" />;
}
