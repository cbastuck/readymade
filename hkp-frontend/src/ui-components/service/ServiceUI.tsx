import { ReactElement, useEffect, useRef } from "react";

import Resizable, { Size } from "@/components/Resizable";
import { CustomMenuEntry, ServiceAction, ServiceInstance } from "@/types";
import ServiceFrame from "./ServiceFrame";

type Props = {
  service: ServiceInstance;
  children: ReactElement;
  initialSize?: Size;
  customMenuEntries?: Array<CustomMenuEntry>;
  showBypassOnlyIfExplicit?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  className?: string;
  onInit?: (initialState: any) => void;
  onNotification?: (_: ServiceInstance, notification: any) => void;
  onResize?: (svc: ServiceInstance, size: Size) => void;
  onServiceAction: (command: ServiceAction) => void;
};

export default function ServiceUI({
  service,
  children,
  initialSize,
  onResize: onResizeProp,
  showBypassOnlyIfExplicit,
  draggable,
  className = "",
  customMenuEntries,
  resizable = true,
  onInit,
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

  return (
    <ServiceFrame
      service={service}
      onAction={onServiceAction}
      draggable={!!draggable}
      showBypassOnlyIfExplicit={showBypassOnlyIfExplicit}
      customMenuEntries={customMenuEntries}
    >
      <Resizable
        initialSize={initialSize}
        onResize={onResize}
        disabled={!resizable}
      >
        <div
          className={`flex flex-col font-sans text-foreground-font px-4 h-full w-full ${className}`}
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
  onInit: any,
  onNotification: any
) {
  const isFirstRender = useRef<boolean>(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const config = service.getConfiguration?.() || service;
      if (onInit) {
        onInit(config);
      } else if (onNotification) {
        onNotification(service, config);
      }
    }
  }, []);
}
