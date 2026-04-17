import { useState, useCallback } from "react";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadePanel } from "../types";
import { PanelContext } from "./widgetRegistry";
import { LayoutNode, collectKnobDefaults } from "./LayoutNode";

export type PanelProps = {
  panel: FacadePanel;
  boardContext: BoardContextState;
  showTitle: boolean;
};

export function GenericPanel({ panel, boardContext, showTitle }: PanelProps) {
  const [knobValues, setKnobValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    collectKnobDefaults(panel.layout, initial);
    return initial;
  });

  const onKnobChange = useCallback((serviceUuid: string, value: number) => {
    setKnobValues((prev) => ({ ...prev, [serviceUuid]: value }));
  }, []);

  const panelContext: PanelContext = { knobValues, onKnobChange };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {showTitle && panel.title && (
        <div
          style={{
            padding: "8px 16px",
            fontWeight: 600,
            fontSize: 13,
            borderBottom: "1px solid hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
            flexShrink: 0,
          }}
        >
          {panel.title}
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <LayoutNode
          item={panel.layout}
          boardContext={boardContext}
          panelContext={panelContext}
        />
      </div>
    </div>
  );
}
