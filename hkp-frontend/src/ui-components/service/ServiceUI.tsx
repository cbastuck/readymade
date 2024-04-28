import { ReactElement, useEffect, useRef } from "react";

import Resizable, { Size } from "@/components/Resizable";
import { ServiceInstance, ServiceUIProps } from "@/types";
import ServiceFrame from "./ServiceFrame";

type Props = ServiceUIProps & {
  children: ReactElement;
  initialSize?: Size;
  className?: string;
  onInit?: (initialState: any) => void;
  onNotification?: (_: ServiceInstance, notification: any) => void;
  onResize?: (svc: ServiceInstance, size: Size) => void;
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
  frameless = false,
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
      frameless={frameless}
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
