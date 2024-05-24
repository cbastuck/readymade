import { useState } from "react";
import Copyable from "@/components/Copyable";
import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import RadioGroup from "@/ui-components/RadioGroup";
import Button from "@/ui-components/Button";

export default function UuidGeneratorUI(props: ServiceUIProps) {
  const [uuid, setUuid] = useState("");
  const [method, setMethod] = useState("");

  const onInit = (initialState: any) => {
    if (initialState.uuid) {
      setUuid(initialState.uuid);
    }
    if (initialState.method) {
      setMethod(initialState.method);
    }
  };

  const onNotification = (notification: any) => {
    if (needsUpdate(notification.uuid, uuid)) {
      setUuid(notification.uuid);
    }
    if (needsUpdate(notification.method, method)) {
      setMethod(notification.method);
    }
  };

  const onMethod = (method: string) => {
    props.service.configure({ method });
  };

  const onGenerate = () => {
    props.service.configure({ action: "generate" });
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col gap-1">
        <RadioGroup
          title="Method"
          value={method}
          options={["v1", "v4"]}
          onChange={onMethod}
        />
        <Copyable label="UUID" value={uuid} />
        <Button onClick={onGenerate}>Generate</Button>
      </div>
    </ServiceUI>
  );
}
