import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import { State as ServiceState } from "./KeyHandler";

type State = ServiceState;

export default function KeyHandlerUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({
    eventType: "keypress",
  });

  const update = (newState: Partial<State>) => {
    if (needsUpdate(newState.eventType, state.eventType)) {
      setState((state) => ({ ...state, eventType: newState.eventType! }));
    }
  };

  const onInit = (initialState: State) => update(initialState);

  const onNotification = (notification: Partial<State>) => update(notification);

  const { service } = props;
  return (
    <ServiceUI
      {...props}
      className="pb-4"
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: undefined, height: undefined }}
    >
      <div className="flex flex-col gap-2">
        <RadioGroup
          title="Event Type"
          options={["keydown", "keyup", "keypress"]}
          value={state.eventType}
          onChange={(newEventType) =>
            service.configure({
              eventType: newEventType,
            })
          }
        />
      </div>
    </ServiceUI>
  );
}
