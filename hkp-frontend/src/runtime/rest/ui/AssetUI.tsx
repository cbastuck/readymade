import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import AssetPanel, {
  ASSET_PANEL_SIZE,
  AssetPanelState,
  EMPTY_ASSET_STATE,
  readAssetState,
} from "../../ui/AssetPanel";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

/**
 * An `asset` service on a REST runtime. The panel is shared with the browser
 * runtime's; what is here is the wrapper and the route to the service.
 */
export default function AssetUI(props: ServiceUIProps) {
  const [state, setState] = useState<AssetPanelState>(EMPTY_ASSET_STATE);

  const onUpdate = useCallback((next: any) => {
    setState((previous) => readAssetState(next, previous));
  }, []);

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
      initialSize={ASSET_PANEL_SIZE}
    >
      <AssetPanel
        state={state}
        configure={(config) => props.service.configure(config)}
      />
    </RuntimeRestServiceUI>
  );
}
