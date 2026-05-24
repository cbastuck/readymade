import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

type State = { url: string };

export default function WebsocketClientUI(props: ServiceUIProps) {
  const [state, setState] = useState<State>({ url: "" });

  const onInit = (initialState: State) => {
    if (needsUpdate(initialState.url, state.url)) {
      setState({ url: initialState.url });
    }
  };

  const onNotification = (notification: Partial<State>) => {
    if (needsUpdate(notification.url, state.url)) {
      setState((s) => ({ ...s, url: notification.url! }));
    }
  };

  const { service } = props;
  return (
    <ServiceUI
      {...props}
      className="pb-4"
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 480, height: undefined }}
    >
      <SubmittableInput
        fullWidth
        minHeight
        title="URL"
        value={state.url}
        onSubmit={(newUrl) => service.configure({ url: newUrl })}
      />
    </ServiceUI>
  );
}
