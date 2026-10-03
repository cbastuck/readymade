import { DetectWidget } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useNotificationValue } from "./StatusIndicatorRenderer";
import DetectionPreview, {
  Found,
} from "hkp-frontend/src/runtime/browser/services/detect/DetectionPreview";

const DEFAULT_WIDTH = 320;

/**
 * What a Detect service sees, on a facade panel: the last frame it looked at
 * with what it found outlined. Read from the `found` it reports on every
 * frame, so it is the picture the board decided on rather than the camera's.
 */
export function DetectRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<DetectWidget>) {
  const width = widget.width ?? DEFAULT_WIDTH;
  const found = useNotificationValue(boardContext, {
    serviceUuid: widget.serviceUuid,
    path: "found",
  }) as Found | undefined;

  if (!found) {
    return (
      <div
        style={{
          width,
          height: Math.round(width * 0.75),
          borderRadius: 6,
          background: "#111",
          color: "#9ca3af",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Waiting for the first frame…
      </div>
    );
  }
  return <DetectionPreview found={found} width={width} />;
}
