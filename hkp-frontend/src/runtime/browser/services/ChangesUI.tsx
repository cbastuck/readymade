import { useState } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import PillRadioGroup from "hkp-frontend/src/ui-components/PillRadioGroup";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import Button from "hkp-frontend/src/ui-components/Button";
import { EMIT_LABELS, EmitMode } from "./changes-modes";

type Remembered = { seen: boolean; value: unknown };

function describe(remembered: Remembered): string {
  if (!remembered.seen) {
    return "nothing yet";
  }
  const { value } = remembered;
  if (value === undefined) {
    return "undefined";
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  } catch {
    return String(value);
  }
}

export default function ChangesUI(props: ServiceUIProps) {
  const { service } = props;
  const [value, setValue] = useState("");
  const [emit, setEmit] = useState<EmitMode>("change");
  // Live state, not configuration: read off the instance, then kept by notifications.
  const [remembered, setRemembered] = useState<Remembered>(
    () => (service as any).remembered ?? { seen: false, value: undefined },
  );

  const update = (state: any) => {
    if (state.value !== undefined) {
      setValue(state.value);
    }
    if (state.emit !== undefined) {
      setEmit(state.emit);
    }
    if (state.remembered !== undefined) {
      setRemembered(state.remembered);
    }
  };

  return (
    <ServiceUI
      {...props}
      onInit={update}
      onNotification={update}
      initialSize={{ width: 300, height: undefined }}
    >
      <div className="flex flex-col gap-2" style={{ textAlign: "left" }}>
        <InputField
          className="font-menu"
          type="text"
          label="Watch"
          value={value}
          onChange={(next) => service.configure({ value: next })}
        />
        <div className="text-xs opacity-60">
          An expression over <code>params</code>; empty watches the whole input.
        </div>
        <PillRadioGroup
          title="Let through when"
          options={EMIT_LABELS}
          value={emit}
          onChange={(next) => service.configure({ emit: next })}
        />
        <GroupLabel>Remembered</GroupLabel>
        <div className="font-menu text-sm break-all">{describe(remembered)}</div>
        <Button
          className="hkp-svc-btn w-full"
          onClick={() => service.configure({ reset: true })}
        >
          Forget
        </Button>
      </div>
    </ServiceUI>
  );
}
