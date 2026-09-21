import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import HoldPanel, {
  EMPTY_HOLD_STATE,
  HOLD_PANEL_SIZE,
  HoldPanelState,
  readHoldState,
} from "../../ui/HoldPanel";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

/**
 * A Hold on a REST runtime.
 *
 * The panel itself is shared with the browser runtime's — Hold is one service,
 * and the two differ in how a panel reaches it rather than in what there is to
 * see. What is here is the wrapper and the route to the service.
 */
export default function HoldUI(props: ServiceUIProps) {
  const [state, setState] = useState<HoldPanelState>(EMPTY_HOLD_STATE);

  const onUpdate = useCallback((next: any) => {
    setState((previous) => readHoldState(next, previous));
  }, []);

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
      initialSize={HOLD_PANEL_SIZE}
    >
      <HoldPanel
        state={state}
        onLocalChange={(next) =>
          setState((previous) => ({ ...previous, ...next }))
        }
        configure={(config) => props.service.configure(config)}
      />
    </RuntimeRestServiceUI>
  );
}
