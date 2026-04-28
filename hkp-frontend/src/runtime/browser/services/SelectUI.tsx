import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";

export default function SelectUI(props: ServiceUIProps) {
  const { service } = props;
  const [arrayIndex, setArrayIndex] = useState(0);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.arrayIndex !== undefined) setArrayIndex(state.arrayIndex);
      }}
      onNotification={(n: any) => {
        if (n.arrayIndex !== undefined) setArrayIndex(n.arrayIndex);
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Index:
          <input
            type="number"
            value={arrayIndex}
            min={0}
            style={{ width: 50 }}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value));
              setArrayIndex(v);
              service.configure({ arrayIndex: v });
            }}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
