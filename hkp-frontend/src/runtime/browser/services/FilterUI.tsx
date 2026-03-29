import { useState } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";

export default function FilterUI(props: ServiceUIProps) {
  const [conditions, setConditions] = useState<any>(undefined);
  const [aggregator, setAggregator] = useState<any>(undefined);

  const onInit = (initialState: any) => {
    const { conditions: c, aggregator: a } = initialState;
    setConditions(c);
    setAggregator(a);
  };

  const onNotification = (notification: any) => {
    const { conditions: c, aggregator: a } = notification;

    if (c !== undefined) {
      setConditions(c);
    }

    if (a !== undefined) {
      setAggregator(a);
    }
  };

  const renderMain = () => {
    const { service } = props;
    return (
      <div className="filter-service" style={{ textAlign: "left" }}>
        <GroupLabel>Conditions</GroupLabel>
        {conditions &&
          conditions.map((condition: any, cidx: number) => (
            <InputField
              key={`filter-condition-${service.uuuid}-${cidx}`}
              className="font-menu"
              type="text"
              label={`${cidx + 1}`}
              value={condition || ""}
              onChange={(condition) => {
                const updated = condition
                  ? conditions.map((c: any, cci: number) =>
                      cci === cidx ? condition : c
                    )
                  : conditions.filter((_: any, cci: number) => cci !== cidx);
                service.configure({ conditions: updated });
              }}
            />
          ))}
        <Button
          className="my-2 w-full"
          onClick={() => {
            service.configure({ conditions: [...conditions, ""] });
          }}
        >
          Add Condition
        </Button>
        {conditions && conditions.length > 1 && (
          <SelectorField
            className="my-2 mx-0"
            label="Operation"
            options={{ and: "AND", or: "OR" }}
            value={aggregator}
            onChange={({ value: agg }) => {
              service.configure({ aggregator: agg });
            }}
          />
        )}
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 300, height: undefined }}
    >
      {renderMain()}
    </ServiceUI>
  );
}
