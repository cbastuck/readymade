import { ReactNode, useEffect, useRef } from "react";

import Resizable from "hkp-frontend/src/components/Resizable";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceFrame from "./ServiceFrame";
import { Size } from "hkp-frontend/src/common";
import { extractServiceConfiguration } from "hkp-frontend/src/runtime/browser/services/helpers";

type Props = ServiceUIProps & {
  children: ReactNode;
  initialSize?: Size;
  className?: string;
  onInit?: (initialState: any) => void;
  onTimer?: () => void;
  onNotification?: (notification: any) => void;
  onResize?: (svc: ServiceInstance, size: Size) => void;
};

type ServiceLifecycleHandlers = {
  onInit?: (initialState: any) => void;
  onNotification?: (notification: any) => void;
};

export default function ServiceUI({
  service,
  children,
  initialSize,
  onResize: onResizeProp,
  showBypassOnlyIfExplicit,
  className = "",
  customMenuEntries,
  resizable = true,
  frameless = false,
  serviceFrameState,
  onInit,
  onTimer,
  onNotification,
  onServiceAction,
}: Props) {
  const onResize = onResizeProp
    ? (size: Size) => onResizeProp(service, size)
    : undefined;

  useServiceLifecycle(service, { onInit, onNotification });

  useEffect(() => {
    if (onTimer) {
      const t = setInterval(() => onTimer(), 1000);
      return () => clearInterval(t);
    }
  }, [onTimer, service]);

  return (
    <ServiceFrame
      frameless={frameless}
      service={service}
      onAction={onServiceAction}
      showBypassOnlyIfExplicit={showBypassOnlyIfExplicit}
      customMenuEntries={customMenuEntries}
      serviceFrameState={serviceFrameState}
    >
      <Resizable
        initialSize={initialSize}
        onResize={onResize}
        disabled={!resizable}
      >
        <div
          className={`flex flex-col font-sans px-4 h-full w-full ${className}`}
        >
          <div className="h-2" />
          {children}
        </div>
      </Resizable>
    </ServiceFrame>
  );
}

export function needsUpdate<T>(newValue: T, oldValue: T) {
  return newValue !== undefined && newValue !== oldValue;
}

export function needsUpdateStrict<T>(newValue: T, oldValue: T) {
  return !!newValue && newValue !== oldValue;
}

export function useServiceLifecycle(
  service: ServiceInstance,
  handlers: ServiceLifecycleHandlers = {},
) {
  const onInitRef = useRef(handlers.onInit);
  const onNotificationRef = useRef(handlers.onNotification);
  const initializedForService = useRef<ServiceInstance | null>(null);
  onInitRef.current = handlers.onInit;
  onNotificationRef.current = handlers.onNotification;

  useEffect(() => {
    if (!service.app) {
      return;
    }

    const target = (notification: any) => {
      onNotificationRef.current?.(notification);
    };

    service.app.registerNotificationTarget?.(service, target);
    return () => {
      service.app.unregisterNotificationTarget?.(service, target);
    };
  }, [service]);

  const notify = async () => {
    const config = await (service.getConfiguration?.() ||
      Promise.resolve(extractServiceConfiguration(service)));
    if (onInitRef.current) {
      onInitRef.current(config);
    } else if (onNotificationRef.current) {
      onNotificationRef.current(config);
    }
  };

  useEffect(() => {
    if (initializedForService.current !== service) {
      initializedForService.current = service;
      notify();
    }
  }, [service]);
}
