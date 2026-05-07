import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import Knob from "hkp-frontend/src/ui-components/Knob";
import Button from "hkp-frontend/src/ui-components/Button";

export default function SmoothUI(props: ServiceUIProps) {
  const { service } = props;
  const [factor, setFactor] = useState(0.1);

  return (
    <ServiceUI
      {...props}
      onInit={(state: any) => {
        if (state.factor !== undefined) setFactor(state.factor);
      }}
      onNotification={(n: any) => {
        if (n.factor !== undefined) setFactor(n.factor);
      }}
    >
      <div style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Knob
            value={factor}
            min={0}
            max={1}
            width={52}
            height={52}
            label={factor.toFixed(2)}
            onChange={(v) => {
              setFactor(v);
              service.configure({ factor: v });
            }}
          />
          <span>Factor</span>
        </div>
        <Button
          className="hkp-svc-btn mt-2 w-full"
          onClick={() => service.configure({ reset: true })}
        >
          Reset
        </Button>
      </div>
    </ServiceUI>
  );
}
