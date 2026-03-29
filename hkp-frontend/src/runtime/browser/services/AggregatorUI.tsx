import { useState } from "react";

import { ServiceInstance, ServiceUIProps } from "../../../types";
import Input from "hkp-frontend/src/ui-components/Input";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

const aggOptions = ["max value count"];

export default function AggregatorUI(props: ServiceUIProps) {
  const [interval, setInterval] = useState<number>(0);
  const [property, setProperty] = useState<string>("");
  const [aggregator, setAggregator] = useState<string>("");

  const onInit = (initialState: any) => {
    setInterval(initialState.interval || 100);
    setProperty(initialState.property || "");
    setAggregator(initialState.aggregator || aggOptions[0]);
  };

  const onNotification = async (notification: any) => {
    if (needsUpdate(notification.property, property)) {
      setProperty(notification.property);
    }

    if (needsUpdate(notification.interval, interval)) {
      setInterval(notification.interval);
    }
  };

  const renderMain = (service: ServiceInstance) => {
    return (
      <div className="flex flex-col gap-2">
        <Input
          minHeight
          fullWidth
          title="Property"
          value={property}
          onChange={(property) => {
            service.configure({ property });
          }}
        />

        <div className="pt-4">
          <RadioGroup
            id={`aggregator-${service.uuid}`}
            title="Mode"
            options={aggOptions}
            value={aggregator}
            disabled={true}
            onChange={(newAggregator) =>
              service.configure({ aggregator: newAggregator })
            }
          />
        </div>

        <NumberInput
          title="Interval"
          value={interval}
          onChange={(value) => {
            service.configure({ interval: value });
          }}
        >
          ms
        </NumberInput>
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderMain(props.service)}
    </ServiceUI>
  );
}
