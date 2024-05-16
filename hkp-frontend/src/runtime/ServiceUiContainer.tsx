import { Component, ReactElement } from "react";

import ServiceDropBar from "./ServiceDropBar";
import { RuntimeDescriptor, ServiceInstance } from "../types";

type Props = {
  userId: string | undefined;
  boardName: string;
  runtime: RuntimeDescriptor;
  services: Array<ServiceInstance>;
  collapsed?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onCreateServiceUi: (
    boardName: string,
    service: ServiceInstance,
    runtimeId: string,
    userId: string | undefined
  ) => ReactElement;
};
export default class ServiceUiContainer extends Component<Props> {
  render() {
    const {
      userId,
      boardName,
      runtime,
      services,
      collapsed = false,
      onArrangeService,
      onCreateServiceUi,
    } = this.props;

    if (!services) {
      return null;
    }

    return (
      <>
        {services.map((service, pos) => {
          const serviceElement = onCreateServiceUi(
            boardName,
            service,
            runtime.id,
            userId
          );

          return (
            <div
              key={`service-ui-container-${service.uuid}`}
              style={{
                display: collapsed ? "none" : "flex",
                flexDirection: "row",
              }}
            >
              <ServiceDropBar index={pos} onDrop={onArrangeService} />
              {serviceElement}
            </div>
          );
        })}
        <ServiceDropBar index={services.length} onDrop={onArrangeService} />
      </>
    );
  }
}
