import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import InputField from "hkp-frontend/src/components/shared/InputField";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";

export default function IfServiceUI(props: ServiceUIProps) {
  const [condition, setCondition] = useState<string>("");
  const [, setScopeVersion] = useState(0);

  const onInit = (initialState: any) => {
    setCondition(initialState.condition ?? "");
  };

  const onNotification = useCallback((notification: any) => {
    if (notification.condition !== undefined) {
      setCondition(notification.condition);
    }
    if (notification?.__innerScopeReady) {
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as any;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  const { service } = props;

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      <InputField
        label="Condition"
        value={condition}
        onChange={(c) => service.configure({ condition: c })}
      />
      <SubServicePipelineUI
        service={props.service}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
      />
    </ServiceUI>
  );
}
