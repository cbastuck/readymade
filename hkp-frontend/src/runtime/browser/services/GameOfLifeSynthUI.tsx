import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";
import Knob from "hkp-frontend/src/ui-components/Knob";
import { ServiceUIProps } from "hkp-frontend/src/types";
import type { WaveType } from "./GameOfLifeSynth";

const WAVE_TYPES: WaveType[] = [
  // Web Audio built-ins
  "sine",
  "triangle",
  "square",
  "sawtooth",
  // Custom PeriodicWave
  "organ",
  "soft",
  "fifth",
];

export default function GameOfLifeSynthUI(props: ServiceUIProps) {
  const { service } = props;
  const [volume, setVolume] = useState(0.25);
  const [waveType, setWaveType] = useState<WaveType>("sawtooth");

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.volume !== undefined) setVolume(state.volume);
        if (state.waveType !== undefined) setWaveType(state.waveType);
      }}
      onNotification={(n: any) => {
        if (n.volume !== undefined) setVolume(n.volume);
        if (n.waveType !== undefined) setWaveType(n.waveType);
      }}
    >
      <div
        style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Knob
            value={volume}
            min={0}
            max={1}
            width={52}
            height={52}
            label={`${Math.round(volume * 100)}%`}
            onChange={(v) => {
              setVolume(v);
              service.configure({ volume: v });
            }}
          />
          <span>Volume</span>
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Wave:
          <Select
            options={WAVE_TYPES}
            value={waveType}
            onChange={(v) => {
              setWaveType(v as WaveType);
              service.configure({ waveType: v });
            }}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
