import { useState } from "react";
import { ServiceUIProps } from "../../../types";
import ServiceUI, { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import BipolarMeter from "hkp-frontend/src/ui-components/BipolarMeter";

export default function TickRuleDeltaUI(props: ServiceUIProps) {
  const [interval, setInterval] = useState<number>(2000);
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  const onInit = (initialState: any) => {
    if (initialState.interval !== undefined) {
      setInterval(initialState.interval);
    }
  };

  const onNotification = (notification: any) => {
    if (needsUpdate(notification.interval, interval)) {
      setInterval(notification.interval);
      return;
    }
    // Any notification without a known key is a delta snapshot
    if (notification && typeof notification === "object" && !notification.__internal) {
      const isDelta = Object.values(notification).every((v) => typeof v === "number");
      if (isDelta) {
        setDeltas((prev) => ({ ...prev, ...notification }));
      }
    }
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col gap-3">
        <NumberInput
          title="Flush interval"
          value={interval}
          onChange={(value) => props.service.configure({ interval: value })}
        >
          ms
        </NumberInput>
        {Object.keys(deltas).length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {Object.entries(deltas).map(([symbol, delta]) => (
              <BipolarMeter key={symbol} value={delta} label={symbol} />
            ))}
          </div>
        )}
      </div>
    </ServiceUI>
  );
}
