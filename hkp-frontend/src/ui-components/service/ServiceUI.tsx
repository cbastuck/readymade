import { ReactElement, useEffect } from "react";

import Resizable, { Size } from "@/components/Resizable";
import { ServiceInstance } from "@/types";
import { CustomMenuEntry } from "./ServiceFrame";

type Props = {
  service: ServiceInstance;
  children: ReactElement;
  initialSize?: Size;
  customMenuEntries?: Array<CustomMenuEntry>;
  onInit?: (initialState: any) => void;
  onNotification?: (_: ServiceInstance, notification: any) => void;
  onResize?: (svc: ServiceInstance, size: Size) => void;
};

export default function ServiceUI({
  service,
  children,
  initialSize,
  onResize: onResizeProp,
  onNotification,
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
    <Resizable initialSize={initialSize} onResize={onResize}>
      <div className="font-sans text-foreground-font px-4 h-full w-full">
        {children}
      </div>
    </Resizable>
  );
}
