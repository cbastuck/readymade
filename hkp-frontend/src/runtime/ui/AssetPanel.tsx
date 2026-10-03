import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  assetsOfRuntime,
  formatAssetRef,
  parseAssetRef,
} from "hkp-frontend/src/runtime/board/assets";
import { useServiceRuntimeId } from "./BlockUse";

/**
 * The `asset` service's panel: which asset it emits, and what the last pass
 * found there. The choice is among the assets its runtime resolves against —
 * the board's own, or those of the unit that contributed the runtime.
 *
 * Kept apart from either runtime's wrapper because `asset` is one service: in
 * the browser and on a runtime server it differs in how a panel reaches it, not
 * in what there is to see. Each runtime's AssetUI supplies the wrapper and the
 * `configure` that reaches its own service.
 */
export type AssetPanelState = {
  asset: string;
  mediaType: string;
  size: number;
  error: string;
};

export const EMPTY_ASSET_STATE: AssetPanelState = {
  asset: "",
  mediaType: "",
  size: 0,
  error: "",
};

/** What the service reports, read into panel state. */
export function readAssetState(state: any, previous: AssetPanelState): AssetPanelState {
  return {
    asset: typeof state?.asset === "string" ? state.asset : previous.asset,
    mediaType: typeof state?.mediaType === "string" ? state.mediaType : previous.mediaType,
    size: typeof state?.size === "number" ? state.size : previous.size,
    error: typeof state?.error === "string" ? state.error : previous.error,
  };
}

export const ASSET_PANEL_SIZE = { width: 280, height: undefined };

type Props = {
  state: AssetPanelState;
  configure: (config: { asset: string }) => void;
};

export default function AssetPanel({ state, configure }: Props) {
  const board = useBoardContext();
  const runtimeId = useServiceRuntimeId();
  const runtime = board?.runtimes.find((candidate) => candidate.id === runtimeId);
  const assets = assetsOfRuntime(runtime, board?.assets, board?.linkage?.units);
  const options: Record<string, string> = {};
  for (const asset of assets) {
    options[formatAssetRef(asset.id)] = asset.name || asset.id;
  }
  const selectedId = parseAssetRef(state.asset);
  // A reference to an asset that is not declared still shows, so a board that
  // lost one says which rather than looking unconfigured.
  if (state.asset && !(state.asset in options)) {
    options[state.asset] = `${selectedId ?? state.asset} (not declared)`;
  }

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 240 }}>
      {Object.keys(options).length ? (
        <SelectorField
          label="Asset"
          options={options}
          value={state.asset || null}
          placeholder="Choose an asset"
          onChange={({ value }) => configure({ asset: value })}
        />
      ) : (
        <div className="text-sm opacity-70">
          {runtime?.unit
            ? `The unit "${runtime.unit}" declares no assets.`
            : "This board declares no assets. Add one in the asset view."}
        </div>
      )}
      {state.error ? (
        <div className="text-sm text-red-500">{state.error}</div>
      ) : state.mediaType ? (
        <div className="text-sm opacity-70">
          {state.mediaType} · {formatBytes(state.size)}
        </div>
      ) : null}
    </div>
  );
}

export function formatBytes(size: number | undefined): string {
  if (size === undefined) {
    return "size unknown";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
