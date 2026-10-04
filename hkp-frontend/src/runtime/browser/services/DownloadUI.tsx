import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";

/**
 * The Download service's panel: what the file is called, what type it is
 * offered as, and what was saved last.
 */
export default function DownloadUI(props: ServiceUIProps) {
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const update = (config: any) => {
    if (config?.filename !== undefined && needsUpdate(config.filename, filename)) {
      setFilename(config.filename);
    }
    if (config?.mimeType !== undefined && needsUpdate(config.mimeType, mimeType)) {
      setMimeType(config.mimeType);
    }
    if (typeof config?.saved === "string") {
      setSaved(`saved ${config.saved} (${config.bytes} bytes)`);
    }
    if (typeof config?.error === "string") {
      setError(config.error);
    }
  };

  const configure = (config: any) => props.service.configure(config);

  return (
    <ServiceUI {...props} onInit={update} onNotification={update}>
      <div
        className="flex flex-col my-2 gap-2"
        style={{ minWidth: 240, textAlign: "left" }}
      >
        <InputField
          value={filename}
          label="Filename"
          onChange={(value) => configure({ filename: value })}
        />
        <InputField
          value={mimeType}
          label="Type"
          onChange={(value) => configure({ mimeType: value })}
        />
        {saved || error ? (
          <div className="text-xs">
            <span className="opacity-60">{saved}</span>
            {error ? <span style={{ color: "#ef4444" }}> {error}</span> : null}
          </div>
        ) : null}
      </div>
    </ServiceUI>
  );
}
