import React, { Component } from "react";

import Button from "hkp-frontend/src/ui-components/Button";
import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/timeline";
const serviceName = "Timeline";

class TimelineUI extends Component {
  state = {
    events: [],
    capture: false,
  };

  onInit = (initialState) => {
    const { capture, events } = initialState;
    this.setState({ events, capture });
  };

  onNotification = (notification) => {
    const { events } = notification;
    if (events !== undefined) {
      this.setState({ events });
    }
  };

  renderEvent = (event, timelineStart, timelineEnd, index) => {
    const duration = timelineEnd - timelineStart;
    const relPos =
      duration > 0 ? (event.timestamp - timelineStart) / duration : 0;
    return (
      <div
        key={`timeline-event-${event.timestamp}-${index}`}
        style={{
          position: "absolute",
          left: `${Math.floor(relPos * 100)}%`,
          height: "100%",
          width: 1,
          border: "solid 1px #4183c4",
        }}
      />
    );
  };

  renderEvents = (events) => {
    if (!events || events.length < 1) {
      return false;
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    return events.map((ev, index) =>
      this.renderEvent(ev, firstEvent.timestamp, lastEvent.timestamp, index)
    );
  };

  renderTimeline = (events) => {
    return (
      <div style={{ height: "100%" }}>
        <div style={{ height: "50%" }} />
        <div
          style={{
            height: 1,
            borderBottom: "dashed 1px lightgray",
          }}
        />
        <div
          style={{
            position: "relative",
            height: "50%",
            transform: " translateY(-50%)",
          }}
        >
          {this.renderEvents(events)}
        </div>
      </div>
    );
  };

  renderMain = (service) => {
    return (
      <div
        style={{
          width: 400,
          height: 100,
        }}
      >
        <div style={{ height: "70%" }}>
          {this.renderTimeline(service.events)}
        </div>
        <div style={{ height: "30%", margin: "auto" }}>
          <Button
            onClick={() => {
              const capture = !this.state.capture;
              service.configure({ capture });
              this.setState({ capture });
            }}
          >
            {this.state.capture ? "Stop Capture" : "Start Capture"}
          </Button>
        </div>
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

class Timeline {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.events = [];
    this.capture = false;
  }

  configure(config) {
    const { command, capture } = config;

    if (command === "reset") {
      this.events = [];
    }

    if (capture !== undefined) {
      this.capture = capture;
    }
  }

  process(params) {
    if (this.capture) {
      this.events.push({
        timestamp: Date.now(),
        event: { ...params },
      });
      this.app.notify(this, { events: this.events });
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Timeline(app, board, descriptor, id),
  createUI: TimelineUI,
};

export default descriptor;
