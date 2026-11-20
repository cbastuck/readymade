import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import { useMqttFields } from "./MqttFields";

export default function MqttUI(props: ServiceUIProps) {
  const { onUpdate, fields } = useMqttFields((patch) =>
    props.service.configure(patch),
  );
  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      {fields}
    </RuntimeRestServiceUI>
  );
}
