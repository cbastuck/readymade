import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function DecryptUI(props: ServiceUIProps) {
  const { service } = props;
  const [state, setState] = useState<any>({});

  return (
    <ServiceUI
      {...props}
      onInit={(s: any) => setState(s)}
      onNotification={(n: any) => setState((prev: any) => ({ ...prev, ...n }))}
    >
      <div className="flex flex-col" style={{ minWidth: 250 }}>
        <SelectorField
          label="Method"
          options={(state.methods ?? ["aes"]).reduce(
            (a: any, c: string) => ({ ...a, [c]: c }),
            {},
          )}
          value={state.method ?? "aes"}
          onChange={({ value }) => service.configure({ method: value })}
        />
        <InputField
          label="Secret"
          type="password"
          value={state.secret ?? ""}
          onChange={(secret) => service.configure({ secret })}
        />
      </div>
    </ServiceUI>
  );
}
