import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function FlatMapUI(props: ServiceUIProps) {
  const { service } = props;
  const [expression, setExpression] = useState("");

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 300, height: undefined }}
      onInit={(state: any) => {
        if (state.expression !== undefined) setExpression(state.expression);
      }}
      onNotification={(n: any) => {
        if (n.expression !== undefined) setExpression(n.expression);
      }}
    >
      <div style={{ padding: 8 }}>
        <InputField
          label="Expression"
          value={expression}
          isExpandable
          onChange={(v) => {
            setExpression(v);
            service.configure({ expression: v });
          }}
        />
      </div>
    </ServiceUI>
  );
}
