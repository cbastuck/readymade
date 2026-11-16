import { useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

type StreamStepState = {
  status: string;
  fetched: string;
  problem: string;
  layer: number | null;
  tokens: number | null;
  width: number | null;
  added: number | null;
  size: number | null;
  pieces: string[];
  tokenSizes: number[];
};

const INITIAL_STATE: StreamStepState = {
  status: "idle",
  fetched: "",
  problem: "",
  layer: null,
  tokens: null,
  width: null,
  added: null,
  size: null,
  pieces: [],
  tokenSizes: [],
};

/**
 * Shared panel for `token-embed` and `mlp`: shows the residual stream's size
 * per token and how much this step added to it.
 */
export default function StreamStepUI(props: ServiceUIProps) {
  const { service } = props;
  const isMlp = service.serviceId === "mlp";
  const [state, setState] = useState<StreamStepState>(INITIAL_STATE);

  const onUpdate = useCallback((next: any) => {
    if (!next || typeof next !== "object") {
      return;
    }
    setState((prev) => ({
      status: typeof next.status === "string" ? next.status : prev.status,
      fetched: typeof next.fetched === "string" ? next.fetched : prev.fetched,
      problem: typeof next.problem === "string" ? next.problem : prev.problem,
      layer: typeof next.layer === "number" ? next.layer : prev.layer,
      tokens: typeof next.tokens === "number" ? next.tokens : prev.tokens,
      width: typeof next.width === "number" ? next.width : prev.width,
      added: typeof next.added === "number" ? next.added : prev.added,
      size: typeof next.size === "number" ? next.size : prev.size,
      pieces: Array.isArray(next.pieces) ? next.pieces : prev.pieces,
      tokenSizes: Array.isArray(next.tokenSizes)
        ? next.tokenSizes
        : prev.tokenSizes,
    }));
  }, []);

  const maxSize = Math.max(1, ...state.tokenSizes);

  return (
    <RuntimeRestServiceUI
      {...props}
      onInit={onUpdate}
      onNotification={onUpdate}
      genericUI={false}
      initialSize={{ width: 280, height: undefined }}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 240, fontSize: 12 }}>
        <div className="flex items-center justify-between text-xs opacity-75">
          <span>
            {isMlp && state.layer !== null ? `Layer ${state.layer} · ` : ""}
            {state.status}
            {state.fetched ? ` (${state.fetched})` : ""}
          </span>
          {state.size !== null && (
            <span className="font-mono">
              {state.added !== null ? `+${state.added} → ` : ""}
              |stream| {state.size}
            </span>
          )}
        </div>

        {state.problem && (
          <div className="text-xs" style={{ color: "#ef4444" }}>
            {state.problem}
          </div>
        )}

        {isMlp && (
          <InputField
            label="Layer"
            value={String(state.layer ?? 0)}
            onChange={(val) => {
              const parsed = Number.parseInt(val, 10);
              if (Number.isFinite(parsed) && parsed >= 0) {
                setState((prev) => ({ ...prev, layer: parsed }));
                void service.configure({ layer: parsed });
              }
            }}
          />
        )}

        {state.tokenSizes.length > 0 ? (
          <div className="flex flex-col gap-1 pt-1">
            <div className="text-xs opacity-60">
              Stream vector size per token
              {state.width ? ` (${state.width} wide)` : ""}
            </div>
            <div
              className="flex flex-col gap-1 overflow-y-auto"
              style={{ maxHeight: 180 }}
            >
              {state.tokenSizes.map((sz, idx) => (
                <div key={idx} className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className="truncate text-right opacity-80"
                    style={{ width: 68 }}
                    title={state.pieces[idx] ?? String(idx)}
                  >
                    {state.pieces[idx] ?? idx}
                  </span>
                  <div
                    className="flex-1 rounded overflow-hidden"
                    style={{
                      height: 8,
                      background: "rgba(128,128,128,0.18)",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (sz / maxSize) * 100)}%`,
                        height: "100%",
                        background: "#3b82f6",
                      }}
                    />
                  </div>
                  <span className="opacity-70" style={{ width: 42 }}>
                    {sz.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="opacity-60 text-xs py-2">
            Run tokens through to see the stream size per token.
          </div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
