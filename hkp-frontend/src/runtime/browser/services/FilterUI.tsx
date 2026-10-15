import { useState } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Button from "hkp-frontend/src/ui-components/Button";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import { normalizeFilterConditions } from "./base/Filter";

export default function FilterUI(props: ServiceUIProps) {
  const [conditions, setConditions] = useState<string[]>([]);
  const [aggregator, setAggregator] = useState("and");

  const onInit = (initialState: any) => {
    const { conditions: c, aggregator: a } = initialState;
    setConditions(normalizeFilterConditions(c));
    setAggregator(typeof a === "string" ? a : "and");
  };

  const onNotification = (notification: any) => {
    const { conditions: c, aggregator: a } = notification;

    if (c !== undefined) {
      setConditions(normalizeFilterConditions(c));
    }

    if (typeof a === "string") {
      setAggregator(a);
    }
  };

  const renderMain = () => {
    const { service } = props;
    return (
      <div className="filter-service" style={{ textAlign: "left" }}>
        <GroupLabel>Conditions</GroupLabel>
        {conditions.map((condition, cidx) => (
          <InputField
            key={`filter-condition-${service.uuuid}-${cidx}`}
            className="font-menu"
            type="text"
            label={`${cidx + 1}`}
            value={condition || ""}
            onChange={(condition) => {
              const updated = condition
                ? conditions.map((c, cci) =>
                    cci === cidx ? condition : c,
                  )
                : conditions.filter((_, cci) => cci !== cidx);
              service.configure({ conditions: updated });
            }}
          />
        ))}
        <Button
          className="hkp-svc-btn my-2 w-full"
          onClick={() => {
            service.configure({ conditions: [...conditions, ""] });
          }}
        >
          Add Condition
        </Button>
        {conditions.length > 1 && (
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
