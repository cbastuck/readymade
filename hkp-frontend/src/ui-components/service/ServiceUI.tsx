import { ReactNode, useEffect, useRef } from "react";

import Resizable from "@/components/Resizable";
import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceFrame from "./ServiceFrame";
import { Size } from "@/common";

type Props = ServiceUIProps & {
  children: ReactNode;
  initialSize?: Size;
  className?: string;
  onInit?: (initialState: any) => void;
  onTimer?: () => void;
  onNotification?: (notification: any) => void;
  onResize?: (svc: ServiceInstance, size: Size) => void;
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
  onInit,
  onTimer,
  onNotification,
  onServiceAction,
}: Props) {
  const onResize = onResizeProp
    ? (size: Size) => onResizeProp(service, size)
    : undefined;

  useEffect(() => {
    if (service.app && onNotification) {
      service.app.registerNotificationTarget?.(service, onNotification);
    }
    return () => {
      if (service.app && onNotification) {
        service.app.unregisterNotificationTarget?.(service, onNotification);
      }
    };
  }, [service, onNotification]);

  useInitOnFirstRender(service, onInit, onNotification);

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
    >
      <Resizable
        initialSize={initialSize}
        onResize={onResize}
        disabled={!resizable}
      >
        <div
          className={`flex flex-col font-sans px-4 h-full w-full ${className}`}
        >
          {children}
        </div>
      </Resizable>
    </ServiceFrame>
  );
}

export function needsUpdate<T>(newValue: T, oldValue: T) {
  return newValue !== undefined && newValue !== oldValue;
}

function useInitOnFirstRender(
  service: ServiceInstance,
  onInit?: (state: any) => void,
  onNotification?: (svc: ServiceInstance, notification: any) => void
) {
  const notify = async () => {
    const config = await (service.getConfiguration?.() ||
      Promise.resolve(service));
    if (onInit) {
      onInit(config);
    } else if (onNotification) {
      onNotification(service, config);
    }
  };

  const isFirstRender = useRef<boolean>(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      notify();
    }
  }, [notify]);
}
