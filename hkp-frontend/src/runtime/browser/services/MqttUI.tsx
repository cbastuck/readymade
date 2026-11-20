import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import { useMqttFields } from "hkp-frontend/src/runtime/rest/ui/MqttFields";

/** The same panel hkp-node's `mqtt` has: one service, two runtimes. */
export default function MqttUI(props: ServiceUIProps) {
  const { onUpdate, fields } = useMqttFields((patch) =>
    props.service.configure(patch),
  );
  return (
    <ServiceUI {...props} onInit={onUpdate} onNotification={onUpdate}>
      {fields}
    </ServiceUI>
  );
}
