import { useState } from "react";

import { ServiceUIProps } from "../../../types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import Button from "hkp-frontend/src/ui-components/Button";

export default function LocalStorageUI(props: ServiceUIProps) {
  const [items, setItems] = useState<Array<{ key: string; value: string }>>([]);
  const [appliedFilter, setAppliedFilter] = useState<string>("");

  const updateState = (cfg: any) => {
    const { items, filter } = cfg;
    if (items !== undefined) {
      setItems(items);
    }

    if (needsUpdate(filter, appliedFilter)) {
      setAppliedFilter(filter);
    }
  };

  const onInit = (config: any) => {
    updateState(config);
  };

  const onNotification = (notification: any) => {
    updateState(notification);
  };

  const onSubmitFilter = (filter: string) => {
    props.service.configure({ filter });
  };

  const onProcess = () => {
    props.service.configure({ process: true });
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2 min-h-[100px]"
      initialSize={{ width: 400, height: undefined }}
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col h-full gap-2">
        <div className="overflow-y-auto h-[100px]">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between whitespace-nowrap"
            >
              <div>{item.key}</div>
            </div>
          ))}
        </div>
        <SubmittableInput
          fullWidth
          title="Filter"
          value={appliedFilter}
          onSubmit={onSubmitFilter}
        />
        <Button className="hkp-svc-btn mt-2" onClick={onProcess}>
          Process
        </Button>
      </div>
    </ServiceUI>
  );
}
