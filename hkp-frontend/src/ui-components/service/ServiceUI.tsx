import { ReactElement } from "react";

import Resizable, { Size } from "@/components/Resizable";
import { ServiceDescriptor } from "@/types";

type Props = {
  service: ServiceDescriptor;
  children: ReactElement;
  initialSize?: Size;
  onInit?: (initialState: any) => void;
  onNotification?: (_: ServiceDescriptor, notification: any) => void;
  onResize?: (svc: ServiceDescriptor, size: Size) => void;
};

export default function ServiceUI({
  service,
  children,
  initialSize,
  onResize: onResizeProp,
}: Props) {
  const onResize = onResizeProp
    ? (size: Size) => onResizeProp(service, size)
    : undefined;

  return (
    <Resizable initialSize={initialSize} onResize={onResize}>
      <div className="font-sans text-foreground-font px-4 h-full w-full">
        {children}
      </div>
    </Resizable>
  );
}
