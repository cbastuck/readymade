import { useState } from "react";

import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import ServiceBase from "./ServiceBase";
import { State as ServiceState, InputMode } from "./Input";
import RadioGroup from "@/ui-components/RadioGroup";
import SubmittableInput from "@/ui-components/SubmittableInput";

type State = {
  url: string;
  mode: InputMode;
};

export default function InputUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({
    url: "",
    mode: "eventsource",
  });

  const update = (newState: Partial<ServiceState>) => {
    if (needsUpdate(newState.url, state.url)) {
      setState((state) => ({ ...state, url: newState.url! }));
    }

    if (needsUpdate(newState.mode, state.mode)) {
      setState((state) => ({ ...state, mode: newState.mode as InputMode }));
    }
  };

  const onInit = (initialState: ServiceBase<ServiceState>) => {
    update(initialState.state);
  };

  const onNotification = (_: ServiceInstance, notification: any) => {
    update(notification);
  };

  const modeOptions: Array<InputMode> = ["eventsource", "websocket"];

  const { service } = props;
  const { url, mode } = state;
  return (
    <ServiceUI
      {...props}
      className="mb-4"
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
