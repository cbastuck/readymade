import { useCallback, useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import HoldPanel, {
  EMPTY_HOLD_STATE,
  HoldPanelState,
  readHoldState,
} from "../../ui/HoldPanel";

/**
 * A Hold in the browser runtime.
 *
 * The panel itself is shared with the REST runtime's — Hold is one service,
 * and the two differ in how a panel reaches it rather than in what there is to
 * see. What is here is the wrapper and the route to the service, which for a
 * browser service is a direct call on a live object.
 */
export default function HoldUI(props: ServiceUIProps) {
  const [state, setState] = useState<HoldPanelState>(EMPTY_HOLD_STATE);

  const onUpdate = useCallback((next: any) => {
    setState((previous) => readHoldState(next, previous));
  }, []);

  return (
    <ServiceUI {...props} onInit={onUpdate} onNotification={onUpdate}>
      <HoldPanel
        state={state}
        onLocalChange={(next) =>
          setState((previous) => ({ ...previous, ...next }))
        }
        configure={(config) => props.service.configure(config)}
      />
    </ServiceUI>
  );
}
