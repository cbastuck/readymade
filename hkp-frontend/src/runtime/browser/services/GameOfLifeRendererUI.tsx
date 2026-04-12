import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

export default function GameOfLifeRendererUI(props: ServiceUIProps) {
  const { service } = props;
  const [cellSize, setCellSize] = useState(8);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.cellSize !== undefined) setCellSize(state.cellSize);
      }}
      onNotification={(n: any) => {
        if (n.cellSize !== undefined) setCellSize(n.cellSize);
      }}
    >
      <div style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: "#0d47a1" }}>■</span> large &nbsp;
          <span style={{ color: "#1b5e20" }}>■</span> mid &nbsp;
          <span style={{ color: "#b71c1c" }}>■</span> small
        </div>
        <div>
          Cell size:{" "}
          <input
            type="number"
            value={cellSize}
            min={2}
            max={32}
            style={{ width: 48 }}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCellSize(v);
              service.configure({ cellSize: v });
            }}
          />
          px
        </div>
      </div>
    </ServiceUI>
  );
}
