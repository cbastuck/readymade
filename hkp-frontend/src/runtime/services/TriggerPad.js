import React, { Component } from "react";

import ServiceUI from "./ServiceUI";
import HoldableButton from "../../components/shared/HoldableButton";

const serviceId = "hookup.to/service/trigger-pad";
const serviceName = "Trigger Pad";

function makeIndex(rowIndex, colIndex) {
  return `${rowIndex * 4 + colIndex}`;
}

class TriggerPadUI extends Component {
  state = {
    triggeredPads: {},
    assignments: {},
    armedPad: undefined,
  };

  onInit = (service) => {
    this.service = service;
    this.setState({
      armedPad: `${service.armedPad}`,
      assignments: service.padAssignments,
    });
  };

  onNotification = (service, notification) => {
    const { assignments, armedPad } = notification;
    if (assignments) {
      this.setState({ assignments });
    }

    if (armedPad !== undefined) {
      this.setState({ armedPad: `${armedPad}` });
    }
  };

  renderPad = (service, rowIndex, colIndex) => {
    const index = makeIndex(rowIndex, colIndex);
    const isPadTriggered = this.state.triggeredPads[index];
    const isPadAssigned = this.state.assignments[index];
    const isPadArmed = this.state.armedPad === index;
    const onPush = () => {
      service.triggerPad(index);
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
            service.clearPad(index);
          }}
        />
      </div>
    );
  };

  renderRow = (service, rowIndex) => {
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

  renderMain = (service) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
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
        onInit={this.onInit.bind(this)}
        onNotification={this.onNotification.bind(this)}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class TriggerPad {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.armedPad = 0;
    this.padAssignments = {};
  }

  destroy() {}

  configure(config) {
    const { padAssignments, armedPad } = config;

    const notification = {};
    if (padAssignments !== undefined) {
      this.padAssignments = notification.assignments = padAssignments;
    }

    if (armedPad !== undefined) {
      this.armedPad = notification.armedPad = armedPad;
    }

    this.app.notify(this, notification);
  }

  padAssignment(padIndex) {
    return this.padAssignments[padIndex];
  }

  triggerPad(padIndex) {
    const assignment = this.padAssignment(padIndex);
    if (assignment) {
      return this.app.next(this, assignment);
    } else {
      this.armedPad = padIndex;
    }
  }

  clearPad(padIndex) {
    const idx = `${padIndex}`;
    this.padAssignments[idx] = undefined;
    this.armedPad = padIndex;
    this.app.notify(this, {
      assignments: this.padAssignments,
      armedPad: this.armedPad,
    });
  }

  isMatch(params) {
    const isBlob = params instanceof Blob;
    const isObject = typeof params === "object" && params !== null;
    return isBlob || isObject;
  }

  async process(params) {
    if (this.isMatch(params)) {
      if (this.armedPad !== undefined) {
        const idx = `${this.armedPad}`;
        this.padAssignments[idx] = params;
        this.app.notify(this, { assignments: this.padAssignments });
        for (; this.padAssignments[this.armedPad]; ) {
          ++this.armedPad;
        }
        this.app.notify(this, { armedPad: this.armedPad });
      }
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new TriggerPad(app, board, descriptor, id),
  createUI: TriggerPadUI,
};

export default descriptor;

function dataURItoBlob(dataURI) {
  // Split the input to get the mime-type and the data itself
  dataURI = dataURI.split(",");

  // First part contains data:audio/ogg;base64 from which we only need audio/ogg
  const type = dataURI[0].split(":")[1].split(";")[0];

  // Second part is the data itself and we decode it
  const byteString = window.atob(dataURI[1]);
  const byteStringLen = byteString.length;

  // Create ArrayBuffer with the byte string and set the length to it
  const ab = new ArrayBuffer(byteStringLen);

  // Create a typed array out of the array buffer representing each character from as a 8-bit unsigned integer
  const intArray = new Uint8Array(ab);
  for (var i = 0; i < byteStringLen; i++) {
    intArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([intArray], { type });
}
