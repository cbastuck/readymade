import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";
import { useState } from "react";

export default function FetcherUI(props: ServiceUIProps) {
  const idleState = "Idle";
  const [status, setStatus] = useState(idleState);

  const onInit = ({ status: initStatus }: any) => {
    if (initStatus !== undefined) {
      setStatus(initStatus || idleState);
    }
  };

  const onNotification = (notification: any) => {
    const { status: statusUpdate } = notification;
    if (statusUpdate !== undefined) {
      setStatus(statusUpdate || idleState);
    }
  };

  const renderMain = () => {
    return (
      <div
        style={{ width: "100%", textAlign: "left", textOverflow: "ellipsis" }}
      >
        Status: {status}
      </div>
    );
  };

  return (
    <ServiceUI {...props} onInit={onInit} onNotification={onNotification}>
      {renderMain()}
    </ServiceUI>
  );
}
