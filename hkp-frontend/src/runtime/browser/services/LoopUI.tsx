import { useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import Button from "hkp-frontend/src/ui-components/Button";
import BrowserSubServiceUI from "./BrowserSubServiceUI";

const MODES = { run: "Run until done", step: "One round per call" };

const REASONS: { [reason: string]: string } = {
  until: "the condition held",
  maxRounds: "the limit was reached",
  ended: "the pipeline stopped",
  stopped: "stopped",
  failed: "a round failed",
};

/**
 * The Loop panel: when it ends, above the scope it runs once per round.
 */
export default function LoopUI(props: ServiceUIProps) {
  const { service } = props;
  const [until, setUntil] = useState("");
  const [maxRounds, setMaxRounds] = useState(100);
  const [mode, setMode] = useState("run");
  const [round, setRound] = useState(0);
  const [reason, setReason] = useState("");

  // Hears the service's state and each round's report, which say the same
  // things about where the loop is.
  const onState = useCallback((state: any) => {
    if (typeof state?.until === "string") {
      setUntil(state.until);
    }
    if (typeof state?.maxRounds === "number") {
      setMaxRounds(state.maxRounds);
    }
    if (state?.mode === "run" || state?.mode === "step") {
      setMode(state.mode);
    }
    if (typeof state?.round === "number") {
      setRound(state.round);
    }
    if (typeof state?.reason === "string") {
      setReason(state.reason);
    }
  }, []);

  return (
    <BrowserSubServiceUI {...props} onState={onState}>
      <div className="flex flex-col pb-2" style={{ minWidth: 220 }}>
        {/* An expression over a round's output, as `params`. Empty: only the
            limit, a stopped pipeline or Stop ends the loop. */}
        <InputField
          label="Until"
          value={until}
          onChange={(value) => service.configure({ until: value })}
        />
        <InputField
          label="Max rounds"
          value={maxRounds > 0 ? String(maxRounds) : ""}
          onChange={(value) => {
            const parsed = Number.parseInt(value, 10);
            service.configure({
              maxRounds: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
            });
          }}
        />
        <SelectorField
          label="Mode"
          value={mode}
          options={MODES}
          onChange={({ value }) => service.configure({ mode: value })}
        />
        <div className="flex gap-2" style={{ marginTop: 6 }}>
          <Button
            className="hkp-svc-btn w-full"
            onClick={() => service.configure({ stop: true })}
          >
            Stop
          </Button>
          <Button
            className="hkp-svc-btn w-full"
            onClick={() => service.configure({ reset: true })}
          >
            Reset
          </Button>
        </div>
        <div className="hkp-svc-field-label" style={{ fontSize: 12, marginTop: 6 }}>
          {round === 0 && !reason
            ? "No round run yet"
            : `Round ${round}${reason ? ` — ${REASONS[reason] ?? reason}` : ""}`}
        </div>
      </div>
    </BrowserSubServiceUI>
  );
}
