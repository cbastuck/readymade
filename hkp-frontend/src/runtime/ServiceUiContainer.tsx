import { Component, ReactElement } from "react";

import { createPlaceholderUI } from "../UIFactory";
import ServiceDropBar from "./ServiceDropBar";
import { RuntimeDescriptor, ServiceAction, ServiceInstance } from "../types";
import React from "react";

type Props = {
  userId: string | undefined;
  boardName: string;
  runtime: RuntimeDescriptor;
  services: Array<ServiceInstance>;
  readonly?: boolean;
  showBypassOnlyIfExplicit?: boolean;
  collapsed?: boolean;
  onArrangeService: (serviceUuid: string, position: number) => void;
  onServiceAction: (command: ServiceAction) => void;
  onCreateServiceUi: (
    boardName: string,
    service: ServiceInstance,
    runtimeId: string,
    userId: string | undefined
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
      showBypassOnlyIfExplicit = false,
      collapsed = false,
      onArrangeService,
      onServiceAction,
      onCreateServiceUi,
    } = this.props;

    if (!services) {
      return false;
    }

    const draggable = !!onArrangeService;

    return (
      services &&
      services.map((service, pos) => {
        const serviceUI = readonly
          ? createPlaceholderUI(service)
          : onCreateServiceUi(boardName, service, runtime.id, userId);
        const serviceElement =
          serviceUI &&
          React.createElement(serviceUI.type, {
            ...serviceUI.props,
            draggable,
            showBypassOnlyIfExplicit,
            onServiceAction,
          });
        return (
          <div
            key={`service-ui-container-${service.uuid}`}
            style={{
              display: collapsed ? "none" : "flex",
              flexDirection: "row",
            }}
          >
            {pos === 0 && (
              <ServiceDropBar index={0} onDrop={onArrangeService} />
            )}

            {serviceElement}

            <ServiceDropBar index={pos + 1} onDrop={onArrangeService} />
          </div>
        );
      })
    );
  }
}
