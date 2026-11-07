import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ZoomOut } from "lucide-react";

import { useBoardContext } from "../../BoardContext";
import {
  boardHasFacade,
  boardHasRuntimes,
  useFacadeView,
} from "../../facade/FacadeViewContext";
import { useOverview } from "../../overview/OverviewContext";
import { useAssetView } from "../../assets/AssetViewContext";
import {
  TOOLBAR_GROUP_BUTTON,
  TOOLBAR_GROUP_ICON_SIZE,
} from "../../components/Toolbar/ToolbarGroup";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui-components/primitives/popover";

type RuntimeZoomApi = {
  zoom: number;
  setZoom: (zoom: number) => void;
};

const RuntimeZoomContext = createContext<RuntimeZoomApi | null>(null);

export function RuntimeZoomProvider({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(100);
  const value = useMemo(() => ({ zoom, setZoom }), [zoom]);
  return (
    <RuntimeZoomContext.Provider value={value}>
      {children}
    </RuntimeZoomContext.Provider>
  );
}

export function useRuntimeZoom() {
  return useContext(RuntimeZoomContext);
}

export function RuntimeZoomToolbarButton() {
  const runtimeZoom = useRuntimeZoom();
  const boardContext = useBoardContext();
  const facadeView = useFacadeView();
  const overview = useOverview();
  const assetView = useAssetView();
  const [open, setOpen] = useState(false);

  const disabled =
    !boardHasRuntimes(boardContext) ||
    !!overview?.visible ||
    !!assetView?.visible ||
    (boardHasFacade(boardContext) && facadeView?.showRuntime === false);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  if (!runtimeZoom) {
    return null;
  }

  return (
    <Popover open={!disabled && open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? "Runtime zoom — show the runtimes first" : `Runtime zoom: ${runtimeZoom.zoom}%`}
          aria-label="Adjust runtime zoom"
          aria-expanded={!disabled && open}
          style={{
            ...TOOLBAR_GROUP_BUTTON,
            background: "none",
            color:
              runtimeZoom.zoom < 100
                ? "var(--hkp-accent, #0abcfb)"
                : "var(--text, #1a1a1a)",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <ZoomOut size={TOOLBAR_GROUP_ICON_SIZE} strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="w-auto p-3"
        aria-label="Runtime zoom"
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>{runtimeZoom.zoom}%</span>
          <input
            aria-label="Runtime zoom"
            type="range"
            min={25}
            max={100}
            step={5}
            value={runtimeZoom.zoom}
            onChange={(event) => runtimeZoom.setZoom(Number(event.target.value))}
            style={{ writingMode: "vertical-lr", direction: "rtl", height: 140 }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
