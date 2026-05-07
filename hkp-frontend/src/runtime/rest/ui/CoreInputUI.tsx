import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
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

const BUFFER_SIZE_OPTIONS: Record<string, string> = {
  "64": "64",
  "128": "128",
  "256": "256",
  "512": "512",
  "1024": "1024",
  "2048": "2048",
  "4096": "4096",
};

export default function CoreInputUI(props: ServiceUIProps) {
  const [availableDevices, setAvailableDevices] = useState<InputDevice[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] =
    useState<InputDevice | null>(null);
  const [deferPropagation, setDeferPropagation] = useState<boolean>(false);
  const [sampleRate, setSampleRate] = useState<number>(0);
  const [bufferSize, setBufferSize] = useState<number>(0);
  const [availableSampleRates, setAvailableSampleRates] = useState<number[]>([]);
  const [pendingSampleRate, setPendingSampleRate] = useState<number | null>(null);
  const [pendingBufferSize, setPendingBufferSize] = useState<number | null>(null);

  const bypass = props.service.state?.bypass === true;
  const hasDevice = !!selectedInputDevice;
  const audioSettingsEditable = bypass && hasDevice;

  const displayedSampleRate = bypass && pendingSampleRate !== null ? pendingSampleRate : sampleRate;
  const displayedBufferSize = bypass && pendingBufferSize !== null ? pendingBufferSize : bufferSize;

  const onUpdate = (message: any) => {
    const devices: InputDevice[] =
      message.availableDevices !== undefined
        ? message.availableDevices
        : availableDevices;

    if (message.availableDevices !== undefined) {
      setAvailableDevices(message.availableDevices);
    }

    if (message.deferPropagation !== undefined) {
      setDeferPropagation(message.deferPropagation);
    }

    if (message.currentDeviceName !== undefined) {
      const device = devices.find(
        (d) => d.deviceName === message.currentDeviceName,
      );
      if (device) {
        setSelectedInputDevice(device);
      }
    }

    if (message.sampleRate !== undefined) {
      setSampleRate(message.sampleRate);
      if (!message.bypass) {
        setPendingSampleRate(null);
      }
    }

    if (message.bufferSize !== undefined) {
      setBufferSize(message.bufferSize);
      if (!message.bypass) {
        setPendingBufferSize(null);
      }
    }

    if (message.availableSampleRates !== undefined) {
      setAvailableSampleRates(message.availableSampleRates);
    }
  };

  const deviceOptions = useMemo(() => {
    return availableDevices
      .filter((device) => device.type === "input")
      .reduce(
        (acc: object, cur: InputDevice) => ({
          ...acc,
          [cur.deviceName]: cur.deviceName,
        }),
        {},
      );
  }, [availableDevices]);

  const sampleRateOptions = useMemo(() => {
    return availableSampleRates.reduce(
      (acc: object, rate: number) => ({
        ...acc,
        [String(rate)]: `${rate} Hz`,
      }),
      {},
    );
  }, [availableSampleRates]);

  const onChangeInput = (value: OnChangeValue) => {
    const device = availableDevices.find((d) => d.deviceName === value.value);
    if (device) {
      props.service.configure({ preferredInputDeviceName: device.deviceName });
    }
  };

  const onChangeSampleRate = (value: OnChangeValue) => {
    props.service.configure({ preferredSampleRate: Number(value.value) });
    setPendingSampleRate(Number(value.value));
  };

  const onChangeBufferSize = (value: OnChangeValue) => {
    props.service.configure({ preferredBufferSize: Number(value.value) });
    setPendingBufferSize(Number(value.value));
  };

  const onChangeDeferPropagation = (defer: boolean) => {
    props.service.configure({ deferPropagation: defer });
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2">
        <InputField
          label="Device"
          value={selectedInputDevice?.deviceName || ""}
          disabled={true}
        />
        <SelectorField
          value={selectedInputDevice?.deviceName || ""}
          label="Options"
          options={deviceOptions}
          onChange={onChangeInput}
          labelStyle={{ textTransform: "capitalize", textAlign: "left" }}
        />
        <div className="flex gap-2">
          <SelectorField
            value={displayedSampleRate ? String(displayedSampleRate) : ""}
            label="Sample Rate"
            options={sampleRateOptions}
            onChange={onChangeSampleRate}
            disabled={!audioSettingsEditable}
            labelStyle={{ textTransform: "capitalize", textAlign: "left" }}
            uppercaseKeys={false}
            uppercaseValues={false}
          />
          <SelectorField
            value={displayedBufferSize ? String(displayedBufferSize) : ""}
            label="Buffer Size"
            options={BUFFER_SIZE_OPTIONS}
            onChange={onChangeBufferSize}
            disabled={!audioSettingsEditable}
            labelStyle={{ textTransform: "capitalize", textAlign: "left" }}
            uppercaseKeys={false}
            uppercaseValues={false}
          />
        </div>
        <Switch
          className="py-2"
          labelClassName="tracking-[1px] text-base2"
          title="Async"
          checked={deferPropagation}
          onCheckedChange={onChangeDeferPropagation}
        />
      </div>
    </RuntimeRestServiceUI>
  );
}
