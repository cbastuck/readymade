import { useCallback, useEffect, useRef, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { Minus, Plus } from "lucide-react";

export default function AudioEditorUI(props: ServiceUIProps) {
  const initialWidth = 600;
  const initialHeight = 400;
  const [audioData, setAudioData] = useState<Float32Array>(new Float32Array(0));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomStart, setZoomStart] = useState(0);
  const [zoomEnd, setZoomEnd] = useState(1);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartZoom, setPanStartZoom] = useState({ start: 0, end: 1 });
  const [isFocused, setIsFocused] = useState(false);

  const update = (state: any) => {
    const { onProcess } = state;

    if (onProcess !== undefined && onProcess instanceof Float32Array) {
      setAudioData(onProcess);
    }
  };

  const onNotification = (notification: any) => update(notification);
  const onInit = (state: any) => update(state);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { width, height } = canvas;

    // Always clear canvas first
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    // Draw center line
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // If no audio data, just show empty canvas with center line
    if (audioData.length === 0) {
      return;
    }

    const samples = audioData.length;

    // Calculate visible range based on zoom
    const startSample = Math.floor(zoomStart * samples);
    const endSample = Math.ceil(zoomEnd * samples);
    const visibleSamples = endSample - startSample;

    // Draw waveform
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth = 1;
    ctx.beginPath();

    const samplesPerPixel = Math.max(1, visibleSamples / width);

    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);

      if (sampleIndex >= samples) break;

      // For better visualization when zoomed out, find min/max in range
      let min = 0;
      let max = 0;
      const endIdx = Math.min(
        samples,
        startSample + Math.floor((x + 1) * samplesPerPixel)
      );

      for (let i = sampleIndex; i < endIdx; i++) {
        const value = audioData[i];
        min = Math.min(min, value);
        max = Math.max(max, value);
      }

      // Convert to canvas coordinates (assuming -1 to 1 range)
      const yMin = ((1 - max) / 2) * height;
      const yMax = ((1 - min) / 2) * height;

      if (x === 0) {
        ctx.moveTo(x, (yMin + yMax) / 2);
      } else {
        ctx.lineTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
    }

    ctx.stroke();

    // Draw selection if active
    if (selectionStart !== null && selectionEnd !== null) {
      const selStart = Math.min(selectionStart, selectionEnd);
      const selEnd = Math.max(selectionStart, selectionEnd);

      // Convert sample indices to pixel positions
      const startX = ((selStart - startSample) / visibleSamples) * width;
      const endX = ((selEnd - startSample) / visibleSamples) * width;

      // Draw selection overlay
      ctx.fillStyle = "rgba(74, 144, 226, 0.2)";
      ctx.fillRect(startX, 0, endX - startX, height);

      // Draw selection borders
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }

    // Draw time info
    ctx.fillStyle = "#999";
    ctx.font = "12px monospace";
    const duration = samples / 48000; // Assuming 48kHz sample rate
    const visibleDuration = (zoomEnd - zoomStart) * duration;
    let infoText = `Duration: ${duration.toFixed(
      2
    )}s | Visible: ${visibleDuration.toFixed(2)}s | Samples: ${samples}`;

    if (selectionStart !== null && selectionEnd !== null) {
      const selStart = Math.min(selectionStart, selectionEnd);
      const selEnd = Math.max(selectionStart, selectionEnd);
      const selDuration = (selEnd - selStart) / 48000;
      infoText += ` | Selection: ${selDuration.toFixed(3)}s`;
    }

    ctx.fillText(infoText, 10, height - 10);
  }, [audioData, zoomStart, zoomEnd, selectionStart, selectionEnd]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Trigger redraw by setting state
      setAudioData((prev) => prev);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleClear = () => {
    if (props.service) {
      props.service.configure({ action: "clear" });
    }
    // Clear selection when clearing audio
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleZoomIn = () => {
    const range = zoomEnd - zoomStart;
    const center = (zoomStart + zoomEnd) / 2;
    const newRange = range * 0.5;
    setZoomStart(Math.max(0, center - newRange / 2));
    setZoomEnd(Math.min(1, center + newRange / 2));
  };

  const handleZoomOut = () => {
    const range = zoomEnd - zoomStart;
    const center = (zoomStart + zoomEnd) / 2;
    const newRange = Math.min(1, range * 2);
    setZoomStart(Math.max(0, center - newRange / 2));
    setZoomEnd(Math.min(1, center + newRange / 2));
  };

  const handleZoomReset = () => {
    setZoomStart(0);
    setZoomEnd(1);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || audioData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Shift+drag for panning, regular drag for selection
    if (e.shiftKey) {
      setIsPanning(true);
      setPanStartX(x);
      setPanStartZoom({ start: zoomStart, end: zoomEnd });
    } else {
      const normalizedX = x / rect.width;
      const samples = audioData.length;
      const startSample = Math.floor(zoomStart * samples);
      const visibleSamples = Math.ceil(zoomEnd * samples) - startSample;
      const sampleIndex =
        startSample + Math.floor(normalizedX * visibleSamples);

      setSelectionStart(sampleIndex);
      setSelectionEnd(sampleIndex);
      setIsSelecting(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || audioData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (isPanning) {
      // Calculate pan delta
      const deltaX = x - panStartX;
      const normalizedDelta = deltaX / rect.width;
      const range = panStartZoom.end - panStartZoom.start;
      const panAmount = normalizedDelta * range;

      let newStart = panStartZoom.start - panAmount;
      let newEnd = panStartZoom.end - panAmount;

      // Clamp to valid range
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > 1) {
        newStart -= newEnd - 1;
        newEnd = 1;
      }

      setZoomStart(newStart);
      setZoomEnd(newEnd);
    } else if (isSelecting) {
      const normalizedX = Math.max(0, Math.min(1, x / rect.width));
      const samples = audioData.length;
      const startSample = Math.floor(zoomStart * samples);
      const visibleSamples = Math.ceil(zoomEnd * samples) - startSample;
      const sampleIndex =
        startSample + Math.floor(normalizedX * visibleSamples);

      setSelectionEnd(sampleIndex);
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setIsPanning(false);
  };

  const handlePlaySelection = useCallback(() => {
    if (selectionStart === null || selectionEnd === null || !props.service) {
      return;
    }

    const startSample = Math.min(selectionStart, selectionEnd);
    const endSample = Math.max(selectionStart, selectionEnd);

    if (startSample === endSample) {
      return;
    }

    props.service.configure({
      action: "play",
      params: { startSample, endSample },
    });
  }, [selectionStart, selectionEnd, props.service]);

  const handleClearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handlePanLeft = useCallback(() => {
    const range = zoomEnd - zoomStart;
    const panAmount = range * 0.1; // Pan by 10% of visible range
    const newStart = Math.max(0, zoomStart - panAmount);
    const newEnd = newStart + range;
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  }, [zoomStart, zoomEnd]);

  const handlePanRight = useCallback(() => {
    const range = zoomEnd - zoomStart;
    const panAmount = range * 0.1; // Pan by 10% of visible range
    const newEnd = Math.min(1, zoomEnd + panAmount);
    const newStart = newEnd - range;
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  }, [zoomStart, zoomEnd]);

  // Keyboard controls for panning and playing selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when component is focused
      if (!isFocused) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePanLeft();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handlePanRight();
      } else if (e.key === " " || e.key === "Spacebar") {
        // Spacebar to play selection
        if (
          selectionStart !== null &&
          selectionEnd !== null &&
          selectionStart !== selectionEnd
        ) {
          e.preventDefault();
          handlePlaySelection();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    zoomStart,
    zoomEnd,
    isFocused,
    selectionStart,
    selectionEnd,
    handlePanLeft,
    handlePanRight,
    handlePlaySelection,
  ]);

  // Touchpad/wheel scrolling for horizontal panning and pinch-to-zoom
  // Only active when component is focused
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isFocused) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      const range = zoomEnd - zoomStart;

      // Detect pinch-to-zoom gesture (ctrlKey is set on macOS for pinch gestures)
      if (e.ctrlKey) {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const normalizedX = mouseX / rect.width;

        // Calculate zoom center point in normalized coordinates
        const zoomCenter = zoomStart + normalizedX * range;

        // deltaY is negative when zooming in (pinching), positive when zooming out
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        const newRange = Math.min(1, Math.max(0.01, range * zoomFactor));

        // Calculate new start/end maintaining the zoom center
        let newStart = zoomCenter - normalizedX * newRange;
        let newEnd = newStart + newRange;

        // Clamp to valid range
        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > 1) {
          newStart -= newEnd - 1;
          newEnd = 1;
        }

        setZoomStart(newStart);
        setZoomEnd(newEnd);
        return;
      }

      // Only handle when horizontal scrolling is clearly dominant
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        e.preventDefault();

        // Horizontal panning
        const panAmount = (e.deltaX / 1000) * range;

        let newStart = zoomStart + panAmount;
        let newEnd = zoomEnd + panAmount;

        // Clamp to valid range
        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > 1) {
          newStart -= newEnd - 1;
          newEnd = 1;
        }

        setZoomStart(newStart);
        setZoomEnd(newEnd);
      }
      // For vertical scroll: do nothing, event will bubble naturally
    };

    // Use passive:false to allow preventDefault when needed
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [zoomStart, zoomEnd, isFocused]);

  return (
    <ServiceUI
      {...props}
      className="pb-4"
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: initialWidth, height: initialHeight }}
    >
      <div
        className={`flex flex-col w-full h-full outline-none ${
          isFocused ? "border-2 border-blue-400" : "border-2 border-transparent"
        }`}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <div className="h-10 flex gap-2 items-center mb-2 px-2">
          <button
            onClick={handleClear}
            className="hkp-svc-btn px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm text-white"
          >
            Clear
          </button>
          <div className="border-l border-gray-600 h-6"></div>
          <button
            onClick={handlePlaySelection}
            disabled={
              selectionStart === null ||
              selectionEnd === null ||
              selectionStart === selectionEnd
            }
            className="hkp-svc-btn px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm text-white"
            title="Play Selection"
          >
            Play
          </button>
          <button
            onClick={handleClearSelection}
            disabled={selectionStart === null}
            className="hkp-svc-btn px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm text-white"
            title="Clear Selection"
          >
            Clear Sel
          </button>
          <div className="border-l border-gray-600 h-6"></div>
          <div className="flex gap-1">
            <button
              onClick={handleZoomIn}
              className="hkp-svc-btn px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
              title="Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={handleZoomOut}
              className="hkp-svc-btn px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
              title="Zoom Out"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={handleZoomReset}
              className="hkp-svc-btn px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
              title="Reset Zoom"
            >
              Reset
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handlePanLeft}
              disabled={zoomStart === 0}
              className="hkp-svc-btn px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded text-sm text-white"
              title="Pan Left (←)"
            >
              ←
            </button>
            <button
              onClick={handlePanRight}
              disabled={zoomEnd === 1}
              className="hkp-svc-btn px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded text-sm text-white"
              title="Pan Right (→)"
            >
              →
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Zoom: {((zoomEnd - zoomStart) * 100).toFixed(1)}%
          </div>
        </div>
        <div
          ref={containerRef}
          className="flex-1 w-full outline-none"
          style={{ minHeight: "200px" }}
        >
          <canvas
            ref={canvasRef}
            className={`w-full h-full ${
              isPanning ? "cursor-grabbing" : "cursor-crosshair"
            }`}
            style={{ display: "block" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
