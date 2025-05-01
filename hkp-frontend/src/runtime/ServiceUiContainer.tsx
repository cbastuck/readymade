import { ReactElement, useMemo } from "react";

import ServiceWithDropBars from "./ServiceWithDropBars";
import { RuntimeDescriptor, ServiceInstance } from "../types";

type Props = {
  userId: string | undefined;
  boardName: string;
  runtime: RuntimeDescriptor;
  services: Array<ServiceInstance>;
  collapsed?: boolean;
  className?: string;
  wrapServices?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onCreateServiceUi: (
    boardName: string,
    service: ServiceInstance,
    runtimeId: string,
    userId: string | undefined
  ) => ReactElement;
};
export default function ServiceUiContainer(props: Props) {
  const {
    userId,
    boardName,
    runtime,
    services,
    className,
    collapsed = false,
    wrapServices = false,
    onArrangeService,
    onCreateServiceUi,
  } = props;

  const runtimeId = runtime.id;
  const serviceElements = useMemo(() => {
    return services
      ? services.map((service) =>
          onCreateServiceUi(boardName, service, runtimeId, userId)
        )
      : [];
  }, [services, runtimeId, userId, boardName, onCreateServiceUi]);

  if (!services) {
    return null;
  }

  return (
    <div
      className={`overflow-y-hidden w-full pb-4 mt-3 ${className || ""} ${
        wrapServices ? "flex-wrap" : ""
      }`}
    >
      {serviceElements.map((serviceElement, pos) => {
        return (
          <div
            key={`service-ui-container-${services[pos].uuid}`}
            style={{
              display: collapsed ? "none" : "flex",
              flexDirection: "row",
            }}
          >
            <ServiceWithDropBars
              index={pos}
              onDrop={onArrangeService}
              allowDropBehind={pos === services.length - 1}
            >
              {serviceElement}
            </ServiceWithDropBars>
          </div>
        );
      })}
    </div>
  );
}
