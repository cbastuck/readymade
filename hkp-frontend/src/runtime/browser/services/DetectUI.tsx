import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import Slider from "hkp-frontend/src/ui-components/Slider";
import { DETECT_LABELS, DetectMode } from "./detect-modes";
import type { Status } from "./Detect";
import DetectionPreview, { Found } from "./detect/DetectionPreview";

const PREVIEW_WIDTH = 260;

const STATUS_TEXT: { [status in Status]: string } = {
  idle: "Model not loaded",
  loading: "Loading model…",
  ready: "Ready",
  error: "Model failed to load",
};

export default function DetectUI(props: ServiceUIProps) {
  const { service } = props;
  const [mode, setMode] = useState<DetectMode>("face");
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [status, setStatus] = useState<Status>(
    () => (service as any).status ?? "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);

  const update = (state: any) => {
    if (state.mode !== undefined) {
      setMode(state.mode);
    }
    if (state.minConfidence !== undefined) {
      setMinConfidence(state.minConfidence);
    }
    if (state.status !== undefined) {
      setStatus(state.status);
    }
    if (state.error !== undefined) {
      setError(state.error);
    }
    if (state.found !== undefined) {
      setFound(state.found);
    }
  };

  return (
    <ServiceUI
      {...props}
      onInit={update}
      onNotification={update}
      initialSize={{ width: 290, height: undefined }}
    >
      <div className="flex flex-col gap-2" style={{ textAlign: "left" }}>
        <PillRadioGroup
          title="Find"
          options={DETECT_LABELS}
          value={mode}
          onChange={(next) => service.configure({ mode: next })}
        />
        <Slider
          title="Min confidence"
          value={minConfidence}
          min={0}
          max={1}
          step={0.05}
          onChange={(value: number) => {
            setMinConfidence(value);
            service.configure({ minConfidence: value });
          }}
        />
        <div className="flex justify-between text-xs opacity-70">
          <span>{STATUS_TEXT[status]}</span>
          {found && (
            <span>
              {found.faces.length} {found.faces.length === 1 ? "face" : "faces"}
            </span>
          )}
        </div>
        {error && <div className="text-xs text-red-600 break-words">{error}</div>}
        {found && <DetectionPreview found={found} width={PREVIEW_WIDTH} />}
      </div>
    </ServiceUI>
  );
}
