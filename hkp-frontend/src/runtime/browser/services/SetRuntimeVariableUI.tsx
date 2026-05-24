import { useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function SetRuntimeVariableUI(props: ServiceUIProps) {
  const [key, setKey] = useState<string>("");
  const [value, setValue] = useState<string>("");

  const onInit = (initialState: any) => {
    setKey(initialState.key ?? "");
    setValue(
      initialState.value !== null && initialState.value !== undefined
        ? JSON.stringify(initialState.value)
        : "",
    );
  };

  const onNotification = (notification: any) => {
    if (notification.key !== undefined) {
      setKey(notification.key);
    }
    if (notification.value !== undefined) {
      setValue(JSON.stringify(notification.value));
    }
  };

  const { service } = props;

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      <InputField
        label="Key"
        value={key}
        onChange={(k) => service.configure({ key: k })}
      />
      <InputField
        label="Value (JSON)"
        value={value}
        onChange={(v) => {
          try {
            service.configure({ value: JSON.parse(v) });
          } catch {
            service.configure({ value: v });
          }
        }}
      />
    </ServiceUI>
  );
}
