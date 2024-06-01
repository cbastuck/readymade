import { ReactNode, useContext, useEffect, useState } from "react";

import {
  CustomMenuEntry,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
} from "@/types";
import { s, t } from "@/styles";
import ServiceHeader from "./ServiceHeader";
import EditorDialog from "../EditorDialog";
import { filterPrivateMembers } from "@/runtime/browser/services/helpers";
import { ThemeCtx } from "@/views/playground/ThemeContext";

type Props = {
  service: ServiceInstance;
  draggable: boolean;
  showBypassOnlyIfExplicit?: boolean;
  children: ReactNode;
  customMenuEntries?: Array<CustomMenuEntry>;
  frameless?: boolean;
  dropShadowOnHover?: boolean;
  onAction: (action: ServiceAction) => void;
};

export default function ServiceFrame({
  children,
  service,
  showBypassOnlyIfExplicit,
  customMenuEntries,
  frameless = false,
  //dropShadowOnHover = false,
  onAction,
}: Props) {
  const [frameCollapsed, setFrameCollapsed] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [bypass, setBypass] = useState(service?.bypass);

  const onNotification = (notification: any) => {
    const { bypass } = notification || {};
    if (bypass !== undefined) {
      setBypass(bypass);
    }
  };

  useEffect(() => {
    service.app.registerNotificationTarget?.(service, onNotification);
    return () => {
      if (service.app) {
        service.app.unregisterNotificationTarget?.(service, onNotification);
      }
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

  const onBypass = (isBypass: boolean) =>
    service.configure?.({ bypass: isBypass });

  const onHelp = () => {
    const serviceId = service.serviceId || service.__descriptor?.serviceId;
    const parts = serviceId?.split("/") || [];
    if (parts.length > 1) {
    }
  };

  const onConfig = () => setConfigVisible(true);

  const onCloseConfig = () => {
    setFilteredServiceConfig("");
    setConfigVisible(false);
  };

  const onApplyConfig = async (newConfig: string) => {
    try {
      const config = JSON.parse(newConfig);
      await service.configure?.(config); // TODO: not here
      setConfigVisible(false);
    } catch (err) {}
  };

  const onCustomEntry = (item: CustomMenuEntry) => {
    const { config, onClick } = item;
    if (config) {
      service.configure(config);
    } else if (onClick) {
      onClick();
    }
  };

  const [filteredServiceConfig, setFilteredServiceConfig] = useState("");
  useEffect(() => {
    if (configVisible) {
      if (service.getConfiguration) {
        service.getConfiguration().then((cfg) => {
          const buffer = JSON.stringify(cfg, null, 2);
          setFilteredServiceConfig(buffer);
        });
      } else {
        setFilteredServiceConfig(
          JSON.stringify(filterPrivateMembers(service), null, 2)
        );
      }
    }
  }, [service, configVisible]);

  if (frameless) {
    return children;
  }
  // TODO: enabling drop shadow on hover leads to artifacts when opening service menu
  const enableDropShadow = false ? "hover:drop-shadow-lg" : "";
  const theme = useContext(ThemeCtx);
  return (
    <div key={`service-frame-${uuid}`}>
      <div
        className={enableDropShadow}
        style={s(t.unselectable, {
          transition: "filter 1s",
          border: "solid 1px lightgray",
          borderRadius: 5,
          textAlign: "center",
          backgroundColor: theme.serviceBackgroundColor,
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
          customMenuEntries={customMenuEntries}
          onDoubleClick={onHeaderDoubleClick}
          onExpand={onExpand}
          onDelete={onDelete}
          onBypass={onBypass}
          onHelp={onHelp}
          onConfig={onConfig}
          onCustomEntry={onCustomEntry}
        />

        <EditorDialog
          title="Service Configuration"
          value={filteredServiceConfig}
          isOpen={configVisible}
          onClose={onCloseConfig}
          actions={[{ label: "Apply Changes", onAction: onApplyConfig }]}
        />

        <div
          style={{
            position: "relative",
            display: frameCollapsed ? "none" : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
