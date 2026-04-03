import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../../rest/RuntimeRestServiceUI";
import SelectorField, {
  OnChangeValue,
} from "hkp-frontend/src/components/shared/SelectorField";
import { useState } from "react";

type WindowFunction = "none" | "hann" | "hamming" | "blackman" | "rectangular";
type OutputFormat = "magnitude" | "power" | "db";

const WINDOW_OPTIONS = {
  none: "None",
  hann: "Hann",
  hamming: "Hamming",
  blackman: "Blackman",
  rectangular: "Rectangular",
};

const FORMAT_OPTIONS = {
  magnitude: "Magnitude",
  power: "Power",
  db: "dB Scale",
};

const FFT_SIZE_OPTIONS = {
  auto: "Auto",
  "256": "256",
  "512": "512",
  "1024": "1024",
  "2048": "2048",
  "4096": "4096",
  "8192": "8192",
};

export default function FFTUI(props: ServiceUIProps) {
  const [windowFunction, setWindowFunction] = useState<WindowFunction>("none");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("magnitude");
  const [fftSize, setFftSize] = useState<string | null>(null);

  const onUpdate = (message: any) => {
    if (message.windowFunction !== undefined) {
      setWindowFunction(message.windowFunction);
    }

    if (message.outputFormat !== undefined) {
      setOutputFormat(message.outputFormat);
    }

    if (message.fftSize !== undefined) {
      setFftSize(message.fftSize);
    }
  };

  const onChangeWindow = (value: OnChangeValue) => {
    const newValue = value.value === "none" ? null : value.value;
    props.service.configure({ windowFunction: newValue });
  };

  const onChangeOutput = (value: OnChangeValue) => {
    const newValue = value.value === "none" ? null : value.value;
    props.service.configure({ outputFormat: newValue });
  };

  const onChangeFFTSize = (value: OnChangeValue) => {
    const newValue = value.value === "none" ? null : value.value;
    props.service.configure({ fftSize: newValue });
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex mb-4 w-[250px]">
        <div className="text-sm text-gray-500 flex-col gap-2 flex w-full">
          <SelectorField
            value={windowFunction ?? "none"}
            label="Window"
            options={WINDOW_OPTIONS}
            onChange={onChangeWindow}
            labelStyle={{
              textTransform: "capitalize",
              textAlign: "left",
            }}
          />
          <SelectorField
            value={outputFormat}
            label="Format"
            options={FORMAT_OPTIONS}
            onChange={onChangeOutput}
            labelStyle={{
              textTransform: "capitalize",
              textAlign: "left",
            }}
          />
          <SelectorField
            value={fftSize ?? "auto"}
            label="FFTSize"
            options={FFT_SIZE_OPTIONS}
            onChange={onChangeFFTSize}
            labelStyle={{
              textTransform: "capitalize",
              textAlign: "left",
            }}
          />
        </div>
      </div>
    </RuntimeRestServiceUI>
  );
}
