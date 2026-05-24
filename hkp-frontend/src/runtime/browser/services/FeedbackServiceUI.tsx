import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";
import { FeedbackService } from "./FeedbackService";

export default function FeedbackServiceUI(props: ServiceUIProps): JSX.Element {
  const [, setScopeVersion] = useState(0);

  const onNotification = useCallback((notification: any) => {
    if (notification?.__innerScopeReady) {
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as unknown as FeedbackService;
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
