import { useState } from "react";

import InputField from "@/components/shared/InputField";
import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import Button from "@/ui-components/Button";

export default function FetcherUI(props: ServiceUIProps) {
  const idleState = "Idle";
  const [status, setStatus] = useState(idleState);
  const [url, setUrl] = useState("");

  const update = (config: any) => {
    if (config?.status !== undefined) {
      setStatus(status || idleState);
    }

    if (needsUpdate(config?.url, url)) {
      setUrl(config.url);
    }
  };

  const onInit = ({ status: initStatus }: any) => update(initStatus);

  const onNotification = (notification: any) => update(notification);

  const onChangeUrl = (url: string) => props.service.configure({ url });

  const onFetch = () =>
    props.service.configure({
      command: { action: "fetch", params: { isJSON: true } },
    });

  const renderMain = () => {
    return (
      <div
        className="h-full flex flex-col my-2"
        style={{ width: "100%", textAlign: "left", textOverflow: "ellipsis" }}
      >
        Status: {status}
        <InputField value={url} label="URL" onChange={onChangeUrl} />
        <Button className="w-full" onClick={onFetch}>
          Fetch
        </Button>
      </div>
    );
  };

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      {renderMain()}
    </ServiceUI>
  );
}
