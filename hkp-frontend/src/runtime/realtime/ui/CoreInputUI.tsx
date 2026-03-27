import { ServiceUIProps } from "hkp-frontend/src/types";
import RealtimeRuntimeServiceUI from "../RealtimeRuntimeServiceUI";
import SelectorField, {
  OnChangeValue,
} from "hkp-frontend/src/components/shared/SelectorField";
import { useMemo, useState } from "react";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Switch from "hkp-frontend/src/ui-components/Switch";

type InputDevice = {
  deviceID: number;
  deviceName: string;
  type: string;
};
export default function CoreInputUI(props: ServiceUIProps) {
  const [availableDevices, setAvailableDevices] = useState<InputDevice[]>([]);
  const [deferPropagation, setDeferPropagation] = useState<boolean>(false);
  const onUpdate = (message: any) => {
    if (message.deferPropagation !== undefined) {
      setDeferPropagation(message.deferPropagation);
    }

    if (message.availableDevices !== undefined) {
      setAvailableDevices(message.availableDevices);
    }

    if (message.currentDeviceName !== undefined) {
      const device = availableDevices.find(
        (d) => d.deviceName === message.currentDeviceName
      );
      if (device) {
        setSelectedInputDevice(device);
      }
    }
  };
  const [selectedInputDevice, setSelectedInputDevice] =
    useState<InputDevice | null>(null);
  const options = useMemo(() => {
    if (availableDevices.length > 0) {
      return availableDevices
        .filter((device) => device.type === "input")
        .reduce(
          (acc: object, cur: InputDevice) => ({
            ...acc,
            [cur.deviceName]: cur.deviceName,
          }),
          {}
        );
    } else {
      return {};
    }
  }, [availableDevices]);

  const onChangeInput = (value: OnChangeValue) => {
    const device = availableDevices.find((d) => d.deviceName === value.value);
    if (device) {
      console.log("CoreInputUI.onChangeInput", value, device);
      props.service.configure({ preferredInputDeviceName: device.deviceName });
    }
  };

  const onChangeDeferPropagation = (defer: boolean) => {
    console.log("CoreInputUI.onChangeDeferPropagation", defer);
    props.service.configure({ deferPropagation: defer });
  };

  return (
    <RealtimeRuntimeServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-500">
          <InputField
            label="Device"
            value={selectedInputDevice?.deviceName || ""}
            disabled={true}
          />
          <SelectorField
            value={selectedInputDevice?.deviceName || ""}
            label="Options"
            options={options}
            onChange={onChangeInput}
            labelStyle={{
              textTransform: "capitalize",
              textAlign: "left",
            }}
          />
          <Switch
            className="py-2"
            labelClassName="tracking-[1px] text-base2"
            title="Async"
            checked={deferPropagation}
            onCheckedChange={onChangeDeferPropagation}
          />
        </div>
      </div>
    </RealtimeRuntimeServiceUI>
  );
}
