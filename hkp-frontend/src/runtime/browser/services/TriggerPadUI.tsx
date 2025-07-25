import { Component } from "react";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import HoldableButton from "hkp-frontend/src/components/shared/HoldableButton";

type State = {
  triggeredPads: { [key: string]: any };
  assignments: { [key: string]: any };
  armedPad: string | undefined;
};

export default class TriggerPadUI extends Component<ServiceUIProps, State> {
  state: State = {
    triggeredPads: {},
    assignments: {},
    armedPad: undefined,
  };

  onInit = (initialState: any) => {
    this.setState({
      armedPad: `${initialState.armedPad}`,
      assignments: initialState.padAssignments,
    });
  };

  onNotification = (notification: any) => {
    const { assignments, armedPad } = notification;
    if (assignments) {
      this.setState({ assignments });
    }

    if (armedPad !== undefined) {
      this.setState({ armedPad: `${armedPad}` });
    }
  };

  renderPad = (
    service: ServiceInstance,
    rowIndex: number,
    colIndex: number
  ) => {
    const index = makeIndex(rowIndex, colIndex);
    const isPadTriggered = this.state.triggeredPads[index];
    const isPadAssigned = this.state.assignments[index];
    const isPadArmed = this.state.armedPad === index;
    const onPush = () => {
      // service.triggerPad(index);
      service.configure({
        command: { action: "trigger-pad", params: { padIndex: index } },
      });
      this.setState({
        triggeredPads: {
          ...this.state.triggeredPads,
          [index]: true,
        },
      });
      return true;
    };
    const onEnd = () => {
      if (this.state.triggeredPads[index]) {
        this.setState({
          triggeredPads: {
            ...this.state.triggeredPads,
            [index]: false,
          },
        });
      }
      return true;
    };
    return (
      <div
        onDragOver={(ev) => {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
        }}
        onDrop={async (ev) => {
          const item = ev.dataTransfer.getData("text/plain");
          const blob = dataURItoBlob(item);
          service.configure({
            padAssignments: {
              ...this.state.assignments,
              [`${index}`]: blob,
            },
          });
        }}
      >
        <HoldableButton
          style={{
            width: 100,
            height: 100,
            margin: 2,
            border: `solid 1px ${isPadArmed ? "#4183c4" : "lightgray"}`,
            backgroundColor: !isPadTriggered
              ? isPadAssigned
                ? "#eff"
                : "white"
              : "#4183c4",
          }}
          onDown={onPush}
          onUp={onEnd}
          onRightClick={() => {
            // service.clearPad(index);
            service.configure({
              command: { action: "clear-pad", params: { padIndex: index } },
            });
          }}
        />
      </div>
    );
  };

  renderRow = (service: ServiceInstance, rowIndex: number) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {this.renderPad(service, rowIndex, 0)}
        {this.renderPad(service, rowIndex, 1)}
        {this.renderPad(service, rowIndex, 2)}
        {this.renderPad(service, rowIndex, 3)}
      </div>
    );
  };

  renderMain = (service: ServiceInstance) => {
    return (
      <div className="flex flex-col mb-2">
        {this.renderRow(service, 0)}
        {this.renderRow(service, 1)}
        {this.renderRow(service, 2)}
        {this.renderRow(service, 3)}
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {this.renderMain(this.props.service)}
      </ServiceUI>
    );
  }
}

function makeIndex(rowIndex: number, colIndex: number) {
  return `${rowIndex * 4 + colIndex}`;
}

function dataURItoBlob(dataURI_: string) {
  // Split the input to get the mime-type and the data itself
  const dataURI = dataURI_.split(",");

  // First part contains data:audio/ogg;base64 from which we only need audio/ogg
  const type = dataURI[0].split(":")[1].split(";")[0];

  // Second part is the data itself and we decode it
  const byteString = window.atob(dataURI[1]);
  const byteStringLen = byteString.length;

  // Create ArrayBuffer with the byte string and set the length to it
  const ab = new ArrayBuffer(byteStringLen);

  // Create a typed array out of the array buffer representing each character from as a 8-bit unsigned integer
  const intArray = new Uint8Array(ab);
  for (let i = 0; i < byteStringLen; i++) {
    intArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([intArray], { type });
}
