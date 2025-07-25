import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import { State as ServiceState, InputMode } from "./Input";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

type State = ServiceState;

export default function InputUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({
    url: "",
    mode: "eventsource",
    parseEventsAsJSON: true,
  });

  const update = (newState: Partial<State>) => {
    if (needsUpdate(newState.url, state.url)) {
      setState((state) => ({ ...state, url: newState.url! }));
    }

    if (needsUpdate(newState.mode, state.mode)) {
      setState((state) => ({ ...state, mode: newState.mode as InputMode }));
    }
  };

  const onInit = (initialState: ServiceState) => update(initialState);

  const onNotification = (notification: Partial<ServiceState>) =>
    update(notification);

  const modeOptions: Array<InputMode> = ["eventsource", "websocket"];

  const { service } = props;
  const { url, mode } = state;
  return (
    <ServiceUI
      {...props}
      className="pb-4"
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 480, height: undefined }}
    >
      <div className="flex flex-col gap-2">
        <RadioGroup
          title="Input Mode"
          options={modeOptions}
          value={mode}
          onChange={(newMode) =>
            service.configure({
              mode: newMode,
            })
          }
        />

        <SubmittableInput
          fullWidth
          minHeight
          title="URL"
          value={url}
          onSubmit={(newUrl) => service.configure({ url: newUrl })}
        />
      </div>
    </ServiceUI>
  );
}
