import { ReactElement, useEffect } from "react";

import Resizable, { Size } from "@/components/Resizable";
import { AppImpl, ServiceDescriptor } from "@/types";

type Props = {
  service: ServiceDescriptor;
  children: ReactElement;
  initialSize?: Size;
  app: AppImpl;
  onInit?: (initialState: any) => void;
  onNotification?: (_: ServiceDescriptor, notification: any) => void;
  onResize?: (svc: ServiceDescriptor, size: Size) => void;
};

export default function ServiceUI({
  service,
  children,
  initialSize,
  app,
  onResize: onResizeProp,
  onNotification,
}: Props) {
  const onResize = onResizeProp
    ? (size: Size) => onResizeProp(service, size)
    : undefined;

  useEffect(() => {
    if (app && onNotification) {
      app.registerNotificationTarget?.(service, onNotification);
    }
    return () => {
      app.unregisterNotificationTarget?.(service);
    };
  }, [app, service, onNotification]);

  return (
    <Resizable initialSize={initialSize} onResize={onResize}>
      <div className="font-sans text-foreground-font px-4 h-full w-full">
        {children}
      </div>
    </Resizable>
  );
}
