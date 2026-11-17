import { useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import Switch from "hkp-frontend/src/ui-components/Switch";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import { PanelBlockLock } from "../../ui/BlockUse";

type Candidate = {
  token: number;
  piece?: string;
  p: number;
};

type LayerGuess = {
  layer: number;
  token: number;
  piece: string;
  p: number;
  size: number;
};

type UnembedState = {
  status: string;
  fetched: string;
  problem: string;
  passThrough: boolean;
  candidates: Candidate[];
  layers: LayerGuess[];
};

const INITIAL_STATE: UnembedState = {
  status: "idle",
  fetched: "",
  problem: "",
  passThrough: false,
  candidates: [],
  layers: [],
};

export default function UnembedUI(props: ServiceUIProps) {
  const { service } = props;
  const [state, setState] = useState<UnembedState>(INITIAL_STATE);

  const onUpdate = useCallback((next: any) => {
    if (!next || typeof next !== "object") {
      return;
    }
    setState((prev) => ({
      status: typeof next.status === "string" ? next.status : prev.status,
      fetched: typeof next.fetched === "string" ? next.fetched : prev.fetched,
      problem: typeof next.problem === "string" ? next.problem : prev.problem,
      passThrough:
        typeof next.passThrough === "boolean"
          ? next.passThrough
          : prev.passThrough,
      candidates: Array.isArray(next.candidates)
        ? next.candidates
        : prev.candidates,
      layers: Array.isArray(next.layers) ? next.layers : prev.layers,
    }));
  }, []);

  return (
    <RuntimeRestServiceUI
      {...props}
      onInit={onUpdate}
      onNotification={onUpdate}
      genericUI={false}
      initialSize={{ width: 320, height: undefined }}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 280, fontSize: 12 }}>
        <div className="flex items-center justify-between text-xs opacity-75">
          <span>
            {state.status}
            {state.fetched ? ` (${state.fetched})` : ""}
          </span>
          <span>
            {state.passThrough ? "Early answer (passes stream on)" : "Final scores"}
          </span>
        </div>

        {state.problem && (
          <div className="text-xs" style={{ color: "#ef4444" }}>
            {state.problem}
          </div>
        )}

        {/* Inside a block use, whether it passes the stream on is the
            definition's: shown, not offered. */}
        <PanelBlockLock>
          {(locked) =>
            locked ? null : (
              <Switch
                className="py-1"
                labelClassName="hkp-svc-field-label text-xs"
                title="Pass stream through (early answer)"
                checked={state.passThrough}
                onCheckedChange={() => {
                  const next = !state.passThrough;
                  setState((prev) => ({ ...prev, passThrough: next }));
                  void service.configure({ passThrough: next });
                }}
              />
            )
          }
        </PanelBlockLock>

        {state.candidates.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-xs opacity-60">Most likely next tokens</div>
            {state.candidates.slice(0, 8).map((cand) => (
              <div
                key={cand.token}
                className="flex items-center gap-2 font-mono text-xs"
              >
                <span
                  className="truncate text-right"
                  style={{ width: 72 }}
                  title={cand.piece ?? String(cand.token)}
                >
                  {cand.piece ?? `#${cand.token}`}
                </span>
                <div
                  className="flex-1 rounded overflow-hidden"
                  style={{ height: 8, background: "rgba(128,128,128,0.18)" }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, cand.p * 100)}%`,
                      height: "100%",
                      background: "#22c55e",
                    }}
                  />
                </div>
                <span className="opacity-75" style={{ width: 44 }}>
                  {(cand.p * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="opacity-60 text-xs py-1">
            No scores computed yet.
          </div>
        )}

        {state.layers.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <div className="text-xs opacity-60">
              Top guess after each layer (logit lens)
            </div>
            <div
              className="flex flex-col gap-0.5 overflow-y-auto font-mono text-xs"
              style={{ maxHeight: 150 }}
            >
              {state.layers.map((row, idx) => (
                <div
                  key={`${row.layer}-${idx}`}
                  className="flex items-center justify-between gap-2 opacity-85"
                >
                  <span className="opacity-60">L{row.layer}</span>
                  <span className="truncate font-medium">{row.piece}</span>
                  <span className="opacity-70">
                    {(row.p * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
