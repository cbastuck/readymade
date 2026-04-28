import { useEffect, useRef } from "react";

type Props = {
  active: boolean;
  stream: MediaStream | undefined;
};

export default function WaveformDisplay({ active, stream }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyser = useRef<AnalyserNode | undefined>(undefined);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      if (audioCtx.current) {
        audioCtx.current.close();
      }
    },
    [],
  );

  const visualize = (stream: MediaStream) => {
    if (!active) {
      return;
    }
    if (!audioCtx.current && stream) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new AudioContextClass();
      // taken from: https://github.com/mdn/web-dictaphone
      const source = audioCtx.current.createMediaStreamSource(stream);
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 2048;
      source.connect(analyser.current);
    }
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !active || !audioCtx.current || !analyser.current) {
      return;
    }

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) {
      return;
    }

    // taken from: https://github.com/mdn/web-dictaphone
    const bufferLength = analyser.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = canvas.width;
    const height = canvas.height;

    analyser.current.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = "white";
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = "gray";
    canvasCtx.beginPath();

    const sliceWidth = (width * 1.0) / bufferLength;
    for (let i = 0, x = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();

    requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (stream) {
      if (audioCtx.current) {
        audioCtx.current.close();
        audioCtx.current = null;
        analyser.current = undefined;
      }
      visualize(stream);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  useEffect(() => {
    if (stream) {
      visualize(stream);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return <canvas ref={canvasRef} height={100} />;
}
