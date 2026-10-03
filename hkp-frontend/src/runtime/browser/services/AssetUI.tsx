import { useCallback, useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import AssetPanel, {
  ASSET_PANEL_SIZE,
  AssetPanelState,
  EMPTY_ASSET_STATE,
  readAssetState,
} from "../../ui/AssetPanel";

/**
 * An `asset` service in the browser runtime. The panel is shared with the REST
 * runtime's; what is here is the wrapper and the route to the service, which
 * for a browser service is a direct call on a live object.
 */
export default function AssetUI(props: ServiceUIProps) {
  const [state, setState] = useState<AssetPanelState>(EMPTY_ASSET_STATE);

  const onUpdate = useCallback((next: any) => {
    setState((previous) => readAssetState(next, previous));
  }, []);

  return (
    <ServiceUI
      {...props}
      initialSize={ASSET_PANEL_SIZE}
      onInit={onUpdate}
      onNotification={onUpdate}
    >
      <AssetPanel
        state={state}
        configure={(config) => props.service.configure(config)}
      />
    </ServiceUI>
  );
}
