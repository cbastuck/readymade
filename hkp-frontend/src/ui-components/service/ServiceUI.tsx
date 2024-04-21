import { ReactElement, useEffect } from "react";

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
  customMenuEntries,
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

  return (
    <ServiceFrame
      service={service}
      onAction={onServiceAction}
      draggable={!!draggable}
      showBypassOnlyIfExplicit={showBypassOnlyIfExplicit}
      customMenuEntries={customMenuEntries}
    >
      <Resizable initialSize={initialSize} onResize={onResize}>
        <div className="font-sans text-foreground-font px-4 h-full w-full">
          {children}
        </div>
      </Resizable>
    </ServiceFrame>
  );
}

export function needsUpdate<T>(newValue: T, oldValue: T) {
  return newValue !== undefined && newValue !== oldValue;
}
