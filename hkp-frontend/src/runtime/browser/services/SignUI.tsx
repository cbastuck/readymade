import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import InputField from "hkp-frontend/src/components/shared/InputField";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

export default function SignUI(props: ServiceUIProps) {
  const { service } = props;
  const [state, setState] = useState<any>({});

  const toOptions = (arr: string[] = []) =>
    arr.reduce((a: any, c: string) => ({ ...a, [c]: c }), {});

  return (
    <ServiceUI
      {...props}
      onInit={(s: any) => setState(s)}
      onNotification={(n: any) => setState((prev: any) => ({ ...prev, ...n }))}
    >
      <div style={{ minWidth: 250 }}>
        <SelectorField
          label="Method"
          options={toOptions(state.methods)}
          value={state.method}
          onChange={({ value }) => service.configure({ method: value })}
        />
        <SelectorField
          label="Encoding"
          options={toOptions(state.encodings)}
          value={state.encoding}
          onChange={({ value }) => service.configure({ encoding: value })}
        />
        <InputField
          label="Secret"
          type="password"
          value={state.secret ?? ""}
          onChange={(secret) => service.configure({ secret })}
        />
        {state.method === "HmacSHA256p" && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => service.configure({ finalize: true })}
          >
            Finalize
          </Button>
        )}
      </div>
    </ServiceUI>
  );
}
