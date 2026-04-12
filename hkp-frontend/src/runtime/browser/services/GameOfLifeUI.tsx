import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

export default function GameOfLifeUI(props: ServiceUIProps) {
  const { service } = props;
  const [generation, setGeneration] = useState(0);
  const [cellSize, setCellSize] = useState(8);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.generation !== undefined) setGeneration(state.generation);
        if (state.cellSize !== undefined) setCellSize(state.cellSize);
      }}
      onNotification={(n: any) => {
        if (n.generation !== undefined) setGeneration(n.generation);
        if (n.cellSize !== undefined) setCellSize(n.cellSize);
      }}
    >
      <div style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
        <div>Generation: {generation}</div>
        <div style={{ marginTop: 4 }}>
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
        <button
          style={{ marginTop: 8, padding: "2px 8px" }}
          onClick={() => service.configure({ reset: true })}
        >
          Reset
        </button>
      </div>
    </ServiceUI>
  );
}
