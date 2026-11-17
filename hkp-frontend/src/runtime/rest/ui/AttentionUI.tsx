import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import { usePanelBlockLock } from "../../ui/BlockUse";
import {
  HeatmapMatrixView,
  normalizeHeatmapValue,
} from "hkp-frontend/src/facade/panels/renderers/HeatmapRenderer";

const MASK_OPTIONS: Record<string, string> = {
  causal: "Causal (tokens before)",
  window: "Window (last N tokens)",
  full: "Full (all tokens, including ahead)",
};

type AttentionState = {
  status: string;
  fetched: string;
  problem: string;
  layer: number;
  heads: number;
  head: number;
  mask: string;
  window: number;
  temperature: number;
  disabledHeads: number[];
  added: number | null;
  size: number | null;
  headSizes: number[];
  pieces: string[];
  pattern: number[][];
};

const INITIAL_STATE: AttentionState = {
  status: "idle",
  fetched: "",
  problem: "",
  layer: 0,
  heads: 12,
  head: 0,
  mask: "causal",
  window: 4,
  temperature: 1,
  disabledHeads: [],
  added: null,
  size: null,
  headSizes: [],
  pieces: [],
  pattern: [],
};

export default function AttentionUI(props: ServiceUIProps) {
  const { service } = props;
  const [state, setState] = useState<AttentionState>(INITIAL_STATE);

  const onUpdate = useCallback((next: any) => {
    if (!next || typeof next !== "object") {
      return;
    }
    setState((prev) => ({
      status: typeof next.status === "string" ? next.status : prev.status,
      fetched: typeof next.fetched === "string" ? next.fetched : prev.fetched,
      problem: typeof next.problem === "string" ? next.problem : prev.problem,
      layer: typeof next.layer === "number" ? next.layer : prev.layer,
      heads: typeof next.heads === "number" ? next.heads : prev.heads,
      head: typeof next.head === "number" ? next.head : prev.head,
      mask: typeof next.mask === "string" ? next.mask : prev.mask,
      window: typeof next.window === "number" ? next.window : prev.window,
      temperature:
        typeof next.temperature === "number"
          ? next.temperature
          : prev.temperature,
      disabledHeads: Array.isArray(next.disabledHeads)
        ? next.disabledHeads.filter((h: unknown): h is number => typeof h === "number")
        : prev.disabledHeads,
      added: typeof next.added === "number" ? next.added : prev.added,
      size: typeof next.size === "number" ? next.size : prev.size,
      headSizes: Array.isArray(next.headSizes) ? next.headSizes : prev.headSizes,
      pieces: Array.isArray(next.pieces) ? next.pieces : prev.pieces,
      pattern: Array.isArray(next.pattern) ? next.pattern : prev.pattern,
    }));
  }, []);

  return (
    <RuntimeRestServiceUI
      {...props}
      onInit={onUpdate}
      onNotification={onUpdate}
      genericUI={false}
      initialSize={{ width: 340, height: undefined }}
    >
      <AttentionBody service={service} state={state} setState={setState} />
    </RuntimeRestServiceUI>
  );
}

/**
 * What the panel draws, inside its frame so that it can take over a block
 * use's lock (`usePanelBlockLock`). Inside a use, what changes the layer's
 * computation is the use's to set, on its bar, and is locked here; choosing
 * which head is shown changes nothing the layer hands on, and stays in reach.
 */
function AttentionBody({
  service,
  state,
  setState,
}: {
  service: ServiceUIProps["service"];
  state: AttentionState;
  setState: Dispatch<SetStateAction<AttentionState>>;
}) {
  const locked = usePanelBlockLock();

  const toggleHeadDisabled = (headIdx: number) => {
    const set = new Set(state.disabledHeads);
    if (set.has(headIdx)) {
      set.delete(headIdx);
    } else {
      set.add(headIdx);
    }
    const nextDisabled = Array.from(set).sort((a, b) => a - b);
    setState((prev) => ({ ...prev, disabledHeads: nextDisabled }));
    void service.configure({ disabledHeads: nextDisabled });
  };

  const selectHead = (headIdx: number) => {
    setState((prev) => ({ ...prev, head: headIdx }));
    void service.configure({ head: headIdx });
  };

  // The service reports one head's pattern per call; choosing another head
  // has it report that one from its last call.
  const heatmap = normalizeHeatmapValue(
    state.pattern.length > 0
      ? { matrix: state.pattern, labels: state.pieces }
      : null,
  );
  const headOptions = Object.fromEntries(
    Array.from({ length: Math.max(state.heads, 1) }, (_, idx) => [
      String(idx),
      state.disabledHeads.includes(idx) ? `Head ${idx} (off)` : `Head ${idx}`,
    ]),
  );

  const isSelectedDisabled = state.disabledHeads.includes(state.head);

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 300, fontSize: 12 }}>
      <div className="flex items-center justify-between text-xs opacity-75">
        <span>
          Layer {state.layer} · {state.status}
          {state.fetched ? ` (${state.fetched})` : ""}
        </span>
        {state.added !== null && state.size !== null && (
          <span className="font-mono">
            +{state.added} → |stream| {state.size}
          </span>
        )}
      </div>
      {locked && (
        <div className="text-xs opacity-75">
          Part of a block use: the layer, mask, window, temperature and heads
          switched off are set on the use&apos;s bar.
        </div>
      )}
      {state.problem && (
        <div className="text-xs" style={{ color: "#ef4444" }}>
          {state.problem}
        </div>
      )}

      <InputField
        label="Layer"
        disabled={locked}
        value={String(state.layer)}
        onChange={(val) => {
          const parsed = Number.parseInt(val, 10);
          if (Number.isFinite(parsed) && parsed >= 0) {
            setState((prev) => ({ ...prev, layer: parsed }));
            void service.configure({ layer: parsed });
          }
        }}
      />

      <SelectorField
        label="Mask"
        disabled={locked}
        value={state.mask}
        options={MASK_OPTIONS}
        onChange={({ value }) => {
          setState((prev) => ({ ...prev, mask: value }));
          void service.configure({ mask: value });
        }}
      />

      {state.mask === "window" && (
        <InputField
          label="Window (tokens)"
        disabled={locked}
          value={String(state.window)}
          onChange={(val) => {
            const parsed = Number.parseInt(val, 10);
            if (Number.isFinite(parsed) && parsed >= 1) {
              setState((prev) => ({ ...prev, window: parsed }));
              void service.configure({ window: parsed });
            }
          }}
        />
      )}

      <InputField
        label="Attention temp"
        disabled={locked}
        value={String(state.temperature)}
        onChange={(val) => {
          const parsed = Number.parseFloat(val);
          if (Number.isFinite(parsed) && parsed > 0) {
            setState((prev) => ({ ...prev, temperature: parsed }));
            void service.configure({ temperature: parsed });
          }
        }}
      />

      <SelectorField
        label="Head"
        value={String(state.head)}
        options={headOptions}
        onChange={({ value }) => selectHead(Number.parseInt(value, 10))}
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="opacity-75 text-xs">
          {state.headSizes[state.head] !== undefined
            ? `|out| ${state.headSizes[state.head]}`
            : ""}
        </span>
        <button
          type="button"
          className="hkp-svc-btn px-2 py-0.5 rounded text-xs"
          disabled={locked}
          onClick={() => toggleHeadDisabled(state.head)}
        >
          {isSelectedDisabled
            ? `Switch head ${state.head} back on`
            : `Switch head ${state.head} off`}
        </button>
      </div>

      {heatmap ? (
        <HeatmapMatrixView data={heatmap} cellSize={24} />
      ) : (
        <div className="opacity-60 text-xs py-2">
          Run a token through this layer to see its attention pattern.
        </div>
      )}
    </div>
  );
}
