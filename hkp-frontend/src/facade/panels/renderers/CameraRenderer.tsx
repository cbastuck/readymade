import { useEffect, useMemo, useRef, useState } from "react";
import { CameraWidget } from "../../types";
import { findService } from "../../boardServices";
import { WidgetRendererProps } from "../widgetRegistry";
import {
  captureFrame,
  startVideoStream,
  stopVideoStream,
} from "hkp-frontend/src/runtime/browser/services/camera/videoCapture";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 200;

/**
 * The camera on a facade panel.
 *
 * The Camera service captures through a screenshooter something on screen has
 * handed it, so a facade that shows no service panels has to hand it one
 * itself. Which is not a workaround: asking for the camera is the sort of thing
 * that should happen where a person can see it happening, and the panel is
 * where they are looking.
 *
 * What the pipeline receives is the frame at the widget's capture size, not the
 * preview — the preview can be small, or absent, without changing the picture
 * a board works on.
 */
export function CameraRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<CameraWidget>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(
    () => findService(boardContext, widget.serviceUuid),
    [boardContext.scopes, boardContext.services, widget.serviceUuid],
  );

  const width = widget.width ?? DEFAULT_WIDTH;
  const height = widget.height ?? DEFAULT_HEIGHT;
  const showPreview = widget.preview !== false;
  const previewWidth = widget.previewWidth ?? width;

  useEffect(() => {
    const camera = service as any;
    if (!camera?.registerScreenshooter) {
      return;
    }

    // Held here rather than read back in the cleanup: by then React may have
    // detached the element, and this is the one that was actually streaming.
    const video = videoRef.current;
    let stream: MediaStream | null = null;
    let cancelled = false;

    camera.registerScreenshooter(() =>
      captureFrame(
        videoRef.current,
        canvasRef,
        width,
        height,
        camera.state?.captureFormat ?? "image/png",
      ),
    );

    void (async () => {
      if (!video) {
        return;
      }
      try {
        const started = await startVideoStream(video);
        // Unmounted while the permission prompt was open: the stream arrives
        // with nobody left to show it, and has to be given back.
        if (cancelled) {
          stopVideoStream(started, video);
          return;
        }
        stream = started;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      stopVideoStream(stream, video);
      camera.registerScreenshooter(null);
    };
  }, [service, width, height]);

  return (
    <div style={{ display: "inline-block" }}>
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          display: showPreview ? "block" : "none",
          width: previewWidth,
          borderRadius: 6,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--muted))",
          transform: widget.mirror === false ? undefined : "rotateY(180deg)",
        }}
      />
      {error ? (
        <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
