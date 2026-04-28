import { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import BinarySwitch from "hkp-frontend/src/ui-components/BinarySwitch";
import NumberInput from "hkp-frontend/src/ui-components/NumberInput";

export default function AudioOutputUI(props: ServiceUIProps) {
  const { service } = props;
  const [fadeInTime, setFadeInTime] = useState(0);

  const update = (state: any) => {
    if (needsUpdate(state.fadeInTime, fadeInTime)) {
      setFadeInTime(state.fadeInTime);
    }
  };

  const onInit = (initialState: any) => update(initialState);

  const onNotification = update;

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: 280 }}
    >
      <div className="flex flex-col">
        <canvas
          ref={(canvas) => {
            if (canvas) {
              service.configure({
                command: { action: "visualize", params: { canvas } },
              });
            }
          }}
        />

        <BinarySwitch
          label="Enable Fade-In/Out"
          value={fadeInTime > 0}
          onChange={(fadeInEnabled) =>
            service.configure({
              fadeInTime: fadeInEnabled ? fadeInTime || 1 : 0,
            })
          }
        />
        <div className="flex items-end gap-2">
          <NumberInput
            title="Fade Time"
            value={fadeInTime}
            onChange={(fadeInTime) => service.configure({ fadeInTime })}
            disabled={fadeInTime === 0}
          >
            milliseconds
          </NumberInput>
        </div>
      </div>
    </ServiceUI>
  );
}
