import { useState } from "react";

import { s, t } from "../../../styles";
import InputField from "../../../components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

export default function OutputUI(props: ServiceUIProps) {
  const [bypass, setBypass] = useState<boolean>(true);
  const [mode, setMode] = useState<"websocket" | "post">("websocket");
  const [url, setUrl] = useState<string>("");
  const [flow, setFlow] = useState<string>("stop");
  const [headers, setHeaders] = useState<{ [key: string]: any }>({});

  const onInit = (initialState: any) => {
    const {
      url: u = "",
      bypass: b = true,
      flow: f = "stop",
      headers: h = {},
      mode: m = "websocket",
    } = initialState;

    setUrl(u);
    setBypass(b);
    setFlow(f);
    setHeaders(h);
    setMode(m);
  };

  const onNotification = (notification: any) => {
    const { url: u, bypass: b, flow: f, headers: h, mode: m } = notification;

    if (m !== undefined && mode !== m) {
      setMode(m);
    }
    if (u !== undefined && url !== u) {
      setUrl(u);
    }

    if (b !== undefined && bypass !== b) {
      setBypass(b);
    }

    if (f !== undefined) {
      setFlow(f);
    }

    if (h !== undefined) {
      setHeaders(h);
    }
  };

  const renderMain = () => {
    const { service } = props;
    const headerKeys = Object.keys(headers);
    return (
      <div className="flex flex-col">
        <RadioGroup
          title="Mode"
          options={["websocket", "post"]}
          value={mode}
          onChange={(newMode) => service.configure({ mode: newMode })}
        />
        <InputField
          label="URL"
          value={url}
          onChange={(value) => service.configure({ url: value })}
        />

        {headerKeys.length > 0 && (
          <div style={s(t.tl, t.ls1, t.fs12, t.mt3)}>
            <div>Headers</div>
            {headerKeys.map((key) => (
              <InputField
                key={`output-header-${service.uuid}-${key}`}
                label={key}
                value={headers[key]}
                onChange={async (newValue) => {
                  const newHeaders = {
                    ...headers,
                    [key]: newValue,
                  };
                  await service.configure({ headers: newHeaders });
                }}
              />
            ))}
          </div>
        )}

        <SelectorField
          className="py-1"
          label="Flow"
          style={t.m(0, 10)}
          options={{
            stop: "stop",
            pass: "pass",
          }}
          value={flow}
          onChange={({ value: f }) => service.configure({ flow: f })}
        />
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 300, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderMain()}
    </ServiceUI>
  );
}
