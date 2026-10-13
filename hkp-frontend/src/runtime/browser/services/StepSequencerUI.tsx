import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import { STEP_COUNT, TRACKS } from "./StepSequencer";

const TRACK_COLORS = [
  { on: "#e05a3a", off: "#3a1a10" },
  { on: "#4fc3f7", off: "#0d2a38" },
  { on: "#a5d6a7", off: "#1a2e1a" },
];

export default function StepSequencerUI(props: ServiceUIProps) {
  const { service } = props;

  const [steps, setSteps] = useState<boolean[][]>(
    TRACKS.map(() => Array<boolean>(STEP_COUNT).fill(false)),
  );
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.steps !== undefined) { setSteps(state.steps); }
        if (state.bpm !== undefined) { setBpm(state.bpm); }
        if (state.playing !== undefined) { setPlaying(state.playing); }
        if (state.currentStep !== undefined) { setCurrentStep(state.currentStep); }
      }}
      onNotification={(n: any) => {
        if (n.steps !== undefined) { setSteps([...n.steps]); }
        if (n.bpm !== undefined) { setBpm(n.bpm); }
        if (n.playing !== undefined) { setPlaying(n.playing); }
        if (n.currentStep !== undefined) { setCurrentStep(n.currentStep); }
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12, userSelect: "none" }}>
        {/* Transport row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button
            className="hkp-svc-btn"
            style={{
              padding: "4px 14px",
              borderRadius: 4,
              border: "1px solid #555",
              background: playing ? "#e05a3a" : "#2a2a2a",
              color: "#eee",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 12,
            }}
            onClick={() => {
              service.configure({ command: { action: playing ? "stop" : "play" } });
            }}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>

          <label style={{ color: "#aaa", display: "flex", alignItems: "center", gap: 4 }}>
            BPM
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) {
                  setBpm(v);
                  service.configure({ bpm: v });
                }
              }}
              style={{
                width: 54,
                background: "#1a1a1a",
                color: "#eee",
                border: "1px solid #444",
                borderRadius: 3,
                padding: "2px 4px",
                fontFamily: "monospace",
                fontSize: 12,
              }}
            />
          </label>
        </div>

        {/* Step grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {TRACKS.map((track, trackIdx) => {
            const colors = TRACK_COLORS[trackIdx];
            return (
              <div key={trackIdx} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 38, color: "#aaa", fontSize: 10, textAlign: "right", paddingRight: 4 }}>
                  {track.name}
                </span>
                {Array.from({ length: STEP_COUNT }, (_, stepIdx) => {
                  const isOn = steps[trackIdx]?.[stepIdx] ?? false;
                  const isCurrent = playing && stepIdx === currentStep;
                  const isGroupStart = stepIdx % 4 === 0;
                  return (
                    <div
                      key={stepIdx}
                      onClick={() => {
                        service.configure({
                          command: {
                            action: "toggle-step",
                            params: { track: trackIdx, step: stepIdx },
                          },
                        });
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        cursor: "pointer",
                        marginLeft: isGroupStart && stepIdx > 0 ? 4 : 0,
                        background: isOn ? colors.on : colors.off,
                        boxShadow: isCurrent
                          ? "0 0 0 2px #fff"
                          : isOn
                          ? `0 0 6px ${colors.on}`
                          : "none",
                        transition: "background 0.05s, box-shadow 0.05s",
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </ServiceUI>
  );
}
