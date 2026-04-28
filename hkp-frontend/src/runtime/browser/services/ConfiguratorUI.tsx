import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";
import { Configurator } from "./Configurator";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import Switch from "hkp-frontend/src/ui-components/Switch";

function ConfiguratorUI(props: ServiceUIProps): JSX.Element {
  const { service } = props;

  const [targetServiceUuid, setTargetServiceUuid] = useState("");
  const [targetRuntime, setTargetRuntime] = useState("");
  const [passThrough, setPassThrough] = useState(false);
  const [, setScopeVersion] = useState(0);

  const updateState = (state: any) => {
    if (needsUpdate(state.targetServiceUuid, targetServiceUuid)) {
      setTargetServiceUuid(state.targetServiceUuid ?? "");
    }
    if (needsUpdate(state.targetRuntime, targetRuntime)) {
      setTargetRuntime(state.targetRuntime ?? "");
    }
    if (needsUpdate(state.passThrough, passThrough)) {
      setPassThrough(!!state.passThrough);
    }
  };

  const onNotification = useCallback((notification: any) => {
    if (notification?.__innerScopeReady) {
      setScopeVersion((v) => v + 1);
      return;
    }
    updateState(notification);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as unknown as Configurator;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  return (
    <ServiceUI {...props} onNotification={onNotification}>
      <div className="flex flex-col gap-2 py-1">
        <SubmittableInput
          title="Target Service UUID"
          value={targetServiceUuid}
          placeholder="uuid of target service"
          onSubmit={(val) => service.configure({ targetServiceUuid: val })}
        />
        <SubmittableInput
          title="Target Runtime"
          value={targetRuntime}
          placeholder="runtime id (leave empty for same runtime)"
          onSubmit={(val) => service.configure({ targetRuntime: val })}
        />
        <Switch
          title="Pass Through"
          checked={passThrough}
          onCheckedChange={(val) => service.configure({ passThrough: val })}
        />
      </div>
      <SubServicePipelineUI
        service={props.service}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
      />
    </ServiceUI>
  );
}

export default ConfiguratorUI;
