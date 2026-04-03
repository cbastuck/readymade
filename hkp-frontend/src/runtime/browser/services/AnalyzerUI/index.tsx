import { useRef, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";
import HorizontalSpectrogram from "./HorizontalSpectrogram";
import VerticalSpectrogram from "./VerticalSpectogram";
import Bars from "./Bars";
import Waveform from "./Waveform";
import { isData } from "hkp-frontend/src/runtime/rest/Data";

export default function AnalyzerUI(props: ServiceUIProps) {
  type Modes = "spectogram-v" | "bars" | "spectogram-h" | "waveform";
  const initialWidth = 400;
  const initialHeight = 350;
  const [data, setData] = useState<Array<number>>([]);
  const [mode, setMode] = useState<Modes>("spectogram-h");

  const update = (state: any) => {
    const { onProcess } = state;

    if (needsUpdate(state.mode, mode)) {
      setMode(state.mode);
    }

    if (onProcess !== undefined) {
      setData(onProcess);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const onNotification = (notficiation: any) => update(notficiation);
  const onInit = (state: any) => update(state);
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: initialWidth, height: initialHeight }}
    >
      <div className="flex flex-col justify-between items-center mb-2 w-full h-full">
        <div className="h-10 items-left flex gap-2 w-full">
          <div>Mode:</div>
          <Select
            className="capitalize w-full"
            value={mode}
            onChange={(e) => setMode(e as Modes)}
            options={["spectogram-h", "spectogram-v", "bars", "waveform"]}
          />
        </div>
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: "calc(100% - 30px)" }}
        >
          {mode === "bars" && <Bars data={data} />}
          {mode === "waveform" &&
            (isData(data) ? (
              <Waveform data={data} />
            ) : (
              <div className="h-full flex items-center justify-center">
                Wrong data format for waveform
              </div>
            ))}
          {mode === "spectogram-h" && <HorizontalSpectrogram data={data} />}
          {mode === "spectogram-v" && <VerticalSpectrogram data={data} />}
        </div>
      </div>
    </ServiceUI>
  );
}
