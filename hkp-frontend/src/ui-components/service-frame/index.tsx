import { ReactElement, useEffect, useState } from "react";

import {
  ServiceAction,
  InstanceId,
  ServiceImpl,
  ServiceDescriptor,
} from "@/types";
import { s, t } from "@/styles";
import ServiceHeader from "./ServiceHeader";
import ServiceConfigDialog from "./ServiceConfigDialog";

function getNotificationID(service: InstanceId) {
  return `service-frame-${service.uuid}`;
}

type Props = {
  service: ServiceImpl;
  serviceUi: ReactElement | null;
  draggable: boolean;
  showBypassOnlyIfExplicit?: boolean;
  onAction: (action: ServiceAction) => void;
};

export default function ServiceFrame({
  serviceUi,
  service,
  showBypassOnlyIfExplicit,
  onAction,
}: Props) {
  const [frameCollapsed, setFrameCollapsed] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [bypass, setBypass] = useState(service?.bypass);

  useEffect(() => {
    service.__notificationTargets?.register(
      getNotificationID(service),
      (_, notification) => {
        const { bypass } = notification || {};
        if (bypass !== undefined) {
          setBypass(bypass);
        }
      }
    );
    return () => {
      service.__notificationTargets?.unregister(getNotificationID(service));
    };
  }, [service]);

  const uuid = service && service.uuid;
  const serviceName =
    service?.__descriptor?.serviceName ||
    service.serviceName ||
    "unnamed service";
  const serviceId =
    service?.__descriptor?.serviceId ||
    service.serviceId ||
    "unidentified service";

  const descriptor: ServiceDescriptor = {
    serviceId,
    serviceName,
    uuid,
  };

  const onExpand = (isExpanded: boolean) => {
    setFrameCollapsed(!isExpanded);
  };

  const onHeaderDoubleClick = () => setFrameCollapsed(!frameCollapsed);

  const onDelete = () => {
    if (onAction) {
      onAction({
        action: "remove",
        service,
      });
    }
  };

  const onBypass = (isBypass: boolean) => {
    service.configure?.({ bypass: isBypass });
  };

  const onHelp = () => {
    const serviceId = service.serviceId || service.__descriptor?.serviceId;
    const parts = serviceId?.split("/") || [];
    if (parts.length > 1) {
    }
  };

  const onConfig = () => {
    setConfigVisible(true);
  };

  const onCloseConfig = () => {
    setConfigVisible(false);
  };

  const onApplyConfig = async (newConfig: string) => {
    try {
      const config = JSON.parse(newConfig);
      await service.configure?.(config); // TODO: not here
      setConfigVisible(false);
    } catch (err) {}
  };

  return (
    <div key={`service-frame-${uuid}`}>
      <div
        style={s(t.unselectable, {
          border: "solid 1px lightgray",
          borderRadius: 5,
          textAlign: "center",
          backgroundColor: "white",
          margin: "10px 0px",
          fontSize: 15,
          color: "black",
        })}
      >
        <ServiceHeader
          showBypassOnlyIfExplicit={!!showBypassOnlyIfExplicit}
          bypass={bypass}
          service={descriptor}
          isCollapsed={frameCollapsed}
          onDoubleClick={onHeaderDoubleClick}
          onExpand={onExpand}
          onDelete={onDelete}
          onBypass={onBypass}
          onHelp={onHelp}
          onConfig={onConfig}
        />
        <ServiceConfigDialog
          service={descriptor}
          isOpen={configVisible}
          onClose={onCloseConfig}
          onApply={onApplyConfig}
        />

        <div
          style={{
            position: "relative",
            display: frameCollapsed ? "none" : undefined,
          }}
        >
          {serviceUi || <div />}
        </div>
      </div>
    </div>
  );
}
