import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import Knob from "hkp-frontend/src/ui-components/Knob";
import Select from "hkp-frontend/src/ui-components/Select";
import { DRUM_TYPES } from "./Sound";
import type { GeneratorType, WaveType } from "./Sound";

const GENERATOR_TYPES: GeneratorType[] = ["drums", "synth"];
const NO_TRIGGER = "none";
const WAVE_TYPES: WaveType[] = ["sine", "triangle", "square", "sawtooth", "organ", "soft", "fifth"];

export default function SoundUI(props: ServiceUIProps) {
  const { service } = props;
  const [volume, setVolume] = useState(0.7);
  const [generator, setGenerator] = useState<GeneratorType>("drums");
  const [waveType, setWaveType] = useState<WaveType>("sine");
  const [trigger, setTrigger] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.volume !== undefined) { setVolume(state.volume); }
        if (state.generator !== undefined) { setGenerator(state.generator); }
        if (state.waveType !== undefined) { setWaveType(state.waveType); }
        if (state.trigger !== undefined) { setTrigger(state.trigger); }
      }}
      onNotification={(n: any) => {
        if (n.volume !== undefined) { setVolume(n.volume); }
        if (n.generator !== undefined) { setGenerator(n.generator); }
        if (n.waveType !== undefined) { setWaveType(n.waveType); }
        if (n.trigger !== undefined) { setTrigger(n.trigger); }
        if (n.outputLatencyMs !== undefined) { setLatencyMs(n.outputLatencyMs); }
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
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

        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          Generator:
          <Select
            options={GENERATOR_TYPES}
            value={generator}
            onChange={(v) => {
              setGenerator(v as GeneratorType);
              service.configure({ generator: v });
            }}
          />
        </div>

        {generator === "drums" && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            On any input:
            <Select
              options={[NO_TRIGGER, ...DRUM_TYPES]}
              value={trigger ?? NO_TRIGGER}
              onChange={(v) => {
                const next = v === NO_TRIGGER ? null : v;
                setTrigger(next);
                service.configure({ trigger: next });
              }}
            />
          </div>
        )}

        {latencyMs !== null && (
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Heard {latencyMs} ms after playing
          </div>
        )}

        {generator === "synth" && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
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
        )}
      </div>
    </ServiceUI>
  );
}
