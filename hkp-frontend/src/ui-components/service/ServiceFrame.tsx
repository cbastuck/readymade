import { ReactNode, useEffect, useState } from "react";

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
import { useTheme } from "@/ui-components/ThemeContext";
import ServiceOutputPlug from "./ServiceOutputPlug";

import DragSource from "@/components/DragSource";
import {
  HKP_DND_SERVICE_TYPE,
  ServiceInstanceDropType,
} from "@/components/DropTypes";

type Props = {
  service: ServiceInstance;
  showBypassOnlyIfExplicit?: boolean;
  children: ReactNode;
  customMenuEntries?: Array<CustomMenuEntry>;
  frameless?: boolean;
  onAction: (action: ServiceAction) => void;
};

export default function ServiceFrame({
  children,
  service,
  showBypassOnlyIfExplicit,
  customMenuEntries,
  frameless = false,
  onAction,
}: Props) {
  const [frameCollapsed, setFrameCollapsed] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [bypass, setBypass] = useState(service?.bypass);
  const [recentProgressData, setRecentProgressData] = useState<any>(undefined);

  const [signalOutput, setSignalOutput] = useState(false);
  const [serviceIsProcessing, setServiceIsProcessing] = useState(false);

  const onNotification = (notification: any) => {
    const { bypass, __internal } = notification || {};
    if (bypass !== undefined) {
      setBypass(bypass);
    }

    if (__internal !== undefined) {
      const { state, data } = __internal;
      switch (state) {
        case "call-process":
          setServiceIsProcessing(true);

          return;
        case "call-process-finished":
          setTimeout(() => setServiceIsProcessing(false), 350);
          if (data !== null) {
            setRecentProgressData(data);
            setSignalOutput(true);
            setTimeout(() => setSignalOutput(false), 350);
          }

          return;
      }
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

  const onInject = (data: any) => {
    service.app.next(service, data);
  };

  const onChangeName = (newName: string) => {
    onAction({ action: "rename", service, payload: { value: newName } });
  };

  if (frameless) {
    return children;
  }

  const dragData: ServiceInstanceDropType = filterPrivateMembers(service);

  const cursor = "move";

  const theme = useTheme();

  return (
    <div key={`service-frame-${uuid}`}>
      <div className="flex">
        <div
          style={s(t.unselectable, {
            transition: "border 800ms",
            border: `solid ${theme.serviceBorderWidth}px ${
              serviceIsProcessing ? theme.accentColor : theme.borderColor
            }`,
            borderRadius: theme.borderRadius,
            textAlign: "center",
            backgroundColor: theme.serviceBackgroundColor,
            margin: "10px 0px",
            fontSize: 15,
            color: "black",
          })}
        >
          <DragSource
            className="bg-white"
            style={{ cursor }}
            type={HKP_DND_SERVICE_TYPE}
            value={dragData}
          >
            <ServiceHeader
              showBypassOnlyIfExplicit={!!showBypassOnlyIfExplicit}
              bypass={bypass}
              service={descriptor}
              isCollapsed={frameCollapsed}
              customMenuEntries={customMenuEntries}
              onExpand={onExpand}
              onDelete={onDelete}
              onBypass={onBypass}
              onHelp={onHelp}
              onConfig={onConfig}
              onCustomEntry={onCustomEntry}
              onChangeName={onChangeName}
            />
          </DragSource>

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
        <div className="mt-[25%] pl-2 w-4">
          <ServiceOutputPlug
            isActive={signalOutput}
            data={recentProgressData}
            onInject={onInject}
          />
        </div>
      </div>
    </div>
  );
}
