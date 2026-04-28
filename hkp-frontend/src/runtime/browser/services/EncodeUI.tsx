import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { ENCODE_MODES, type EncodeMode } from "./encode-modes";

const MODE_LABELS: Record<EncodeMode, string> = {
  "base64-encode": "Base64 Encode",
  "base64-decode": "Base64 Decode",
  "url-encode": "URL Encode",
  "url-decode": "URL Decode",
  "hex-encode": "Hex Encode",
  "hex-decode": "Hex Decode",
};

const modeOptions = ENCODE_MODES.reduce(
  (acc, m) => ({ ...acc, [m]: MODE_LABELS[m] }),
  {} as Record<string, string>,
);

export default function EncodeUI(props: ServiceUIProps) {
  const { service } = props;
  const [mode, setMode] = useState<EncodeMode>("base64-encode");

  return (
    <ServiceUI
      {...props}
      onInit={(s: any) => {
        if (s.mode) {
          setMode(s.mode);
        }
      }}
      onNotification={(n: any) => {
        if (n.mode) {
          setMode(n.mode);
        }
      }}
    >
      <div className="flex flex-col" style={{ minWidth: 220 }}>
        <SelectorField
          label="Mode"
          options={modeOptions}
          value={mode}
          onChange={({ value }) => {
            setMode(value as EncodeMode);
            service.configure({ mode: value });
          }}
        />
      </div>
    </ServiceUI>
  );
}
