import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import { useState } from "react";

export default function CoreOutputUI(props: ServiceUIProps) {
  const [availableSamples, setAvailableSamples] = useState(0);

  const onNotification = (notification: any) => {
    const { availableSamples } = notification;
    if (availableSamples !== undefined) {
      setAvailableSamples(availableSamples);
    }
  };
  return (
    <RuntimeRestServiceUI {...props} onNotification={onNotification}>
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-500">
          {availableSamples} samples available
        </div>
      </div>
    </RuntimeRestServiceUI>
  );
}
