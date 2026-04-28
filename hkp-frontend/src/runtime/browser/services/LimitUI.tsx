import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

export default function LimitUI(props: ServiceUIProps) {
  const { service } = props;
  const [n, setN] = useState(10);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.n !== undefined) setN(state.n);
      }}
      onNotification={(n: any) => {
        if (n.n !== undefined) setN(n.n);
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          N:
          <input
            type="number"
            value={n}
            min={1}
            style={{ width: 50 }}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value));
              setN(v);
              service.configure({ n: v });
            }}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
