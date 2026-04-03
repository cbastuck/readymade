import { ReactNode, useEffect, useState } from "react";

import {
  CustomMenuEntry,
  InitialServiceFrameState,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
} from "hkp-frontend/src/types";
import { s, t } from "hkp-frontend/src/styles";
import ServiceHeader from "./ServiceHeader";
import EditorDialog from "../EditorDialog";
import {
  extractServiceConfiguration,
  filterPrivateMembers,
} from "hkp-frontend/src/runtime/browser/services/helpers";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";
import ServiceOutputPlug from "./ServiceOutputPlug";

import DragSource from "hkp-frontend/src/components/DragSource";
import {
  HKP_DND_SERVICE_TYPE,
  ServiceInstanceDropType,
} from "hkp-frontend/src/components/DropTypes";
import { assureJSON } from "hkp-frontend/src/common";

type Props = {
  service: ServiceInstance;
  showBypassOnlyIfExplicit?: boolean;
  children: ReactNode;
  customMenuEntries?: Array<CustomMenuEntry>;
  frameless?: boolean;
  serviceFrameState?: InitialServiceFrameState;
  onAction: (action: ServiceAction) => void;
};

export default function ServiceFrame({
  children,
  service,
  showBypassOnlyIfExplicit,
  customMenuEntries,
  frameless = false,
  serviceFrameState,
  onAction,
}: Props) {
  const [frameCollapsed, setFrameCollapsed] = useState(
    serviceFrameState?.collapsed || false,
  );
  const [configVisible, setConfigVisible] = useState(false);
  const [bypass, setBypass] = useState(
    service?.bypass ?? service?.state?.bypass,
  );
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

  useEffect(() => {
    const nextBypass = service?.bypass ?? service?.state?.bypass;
    if (nextBypass !== undefined) {
      setBypass(nextBypass);
    }
  }, [service, service?.bypass, service?.state?.bypass]);

  const uuid = service && service.uuid;
  const serviceName =
    service.serviceName ||
    service?.__descriptor?.serviceName ||
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

  const onBypass = async (isBypass: boolean) => {
    const previousBypass = bypass;
    setBypass(isBypass);
    try {
      await service.configure?.({ bypass: isBypass });
    } catch (err) {
      setBypass(previousBypass);
      console.error("ServiceFrame.onBypass", err);
    }
  };

  const onHelp = () => {
    const serviceId = service.serviceId || service.__descriptor?.serviceId;
    const parts = serviceId?.split("/") || [];
    if (parts.length > 1) {
      console.log("ServiceFrame.onHelp", parts);
    }
  };

  const onConfig = () => setConfigVisible(true);

  const onCloseConfig = () => {
    setFilteredServiceConfig("");
    setConfigVisible(false);
  };

  const onApplyConfig = async (newConfig: string | object) => {
    try {
      const config = assureJSON(newConfig);
      const actualConfig =
        (config as any)?.state !== undefined ? (config as any).state : config;
      await service.configure?.(actualConfig); // TODO: not here
      setConfigVisible(false);
    } catch (err) {
      console.error("ServiceFrame.onApplyConfig", err);
    }
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
          JSON.stringify(extractServiceConfiguration(service), null, 2),
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

  const theme = useTheme();

  if (frameless) {
    return children;
  }

  const dragData = filterPrivateMembers(
    service,
  ) as unknown as ServiceInstanceDropType;

  const cursor = "move";

  return (
    <div key={`service-frame-${uuid}`} id={`service-frame-${uuid}`}>
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
          })}
          className="shadow-md"
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
        <div className="mt-[30px] px-4 w-7">
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
