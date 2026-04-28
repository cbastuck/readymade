import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";
import { ServiceUIProps } from "hkp-frontend/src/types";
import type { Direction } from "./Sort";

const DIRECTIONS: Direction[] = ["asc", "desc"];

export default function SortUI(props: ServiceUIProps) {
  const { service } = props;
  const [by, setBy] = useState("");
  const [dir, setDir] = useState<Direction>("desc");

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.by !== undefined) setBy(state.by);
        if (state.dir !== undefined) setDir(state.dir);
      }}
      onNotification={(n: any) => {
        if (n.by !== undefined) setBy(n.by);
        if (n.dir !== undefined) setDir(n.dir);
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          By:
          <input
            type="text"
            value={by}
            style={{ width: 80 }}
            onChange={(e) => {
              setBy(e.target.value);
              service.configure({ by: e.target.value });
            }}
          />
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          Dir:
          <Select
            options={DIRECTIONS}
            value={dir}
            onChange={(v) => {
              setDir(v as Direction);
              service.configure({ dir: v });
            }}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
