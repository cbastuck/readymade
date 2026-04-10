import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";
import { BrowserSubService } from "./BrowserSubService";

function BrowserSubServiceUI(props: ServiceUIProps): JSX.Element {
  // Incremented whenever the inner scope finishes (re)building so that
  // getActualInstance picks up the newly created service instances.
  const [, setScopeVersion] = useState(0);

  const onNotification = useCallback((notification: any) => {
    if (notification?.__innerScopeReady) {
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as unknown as BrowserSubService;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  return (
    <ServiceUI {...props} onNotification={onNotification}>
      <SubServicePipelineUI
        service={props.service}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
      />
    </ServiceUI>
  );
}

export default BrowserSubServiceUI;
