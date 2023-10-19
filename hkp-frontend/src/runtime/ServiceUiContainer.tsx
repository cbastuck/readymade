import { Component, ReactElement } from "react";

import ServiceFrame from "../components/ServiceFrame";
import { createPlaceholderUI } from "../UIFactory";
import ServiceDropBar from "./ServiceDropBar";
import { RuntimeDescriptor, ServiceAction, ServiceImpl } from "../types";

type Props = {
  userId: string;
  boardName: string;
  runtime: RuntimeDescriptor;
  services: Array<ServiceImpl>;
  readonly?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onCreateServiceUi: (
    boardName: string,
    service: ServiceImpl,
    runtimeId: string,
    userId: string
  ) => ReactElement | null;
};
export default class ServiceUiContainer extends Component<Props> {
  render() {
    const {
      userId,
      boardName,
      runtime,
      services,
      readonly = false,
      onArrangeService,
      onServiceAction,
      onCreateServiceUi,
    } = this.props;

    if (!services) {
      return false;
    }

    return (
      services &&
      services.map((service, pos) => {
        const serviceUi = readonly
          ? createPlaceholderUI(service)
          : onCreateServiceUi(boardName, service, runtime.id, userId);
        return (
          <div
            key={`scene-frame-${service.uuid}`}
            style={{ display: "flex", flexDirection: "row" }}
          >
            {pos === 0 && (
              <ServiceDropBar index={0} onDrop={onArrangeService} />
            )}

            <ServiceFrame
              service={service}
              serviceUi={serviceUi}
              onAction={onServiceAction}
              draggable={!!onArrangeService}
            />
            <ServiceDropBar index={pos + 1} onDrop={onArrangeService} />
          </div>
        );
      })
    );
  }
}
