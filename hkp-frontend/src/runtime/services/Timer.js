import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import ServiceUI from "./ServiceUI";
import InputField from "../../components/shared/InputField";
import SelectorField from "../../components/shared/SelectorField";
import { s, t } from "../../styles";

import { TimerDescriptor } from "hkp-services";

class TimerUI extends Component {
  state = {
    timerIsRunning: false,
    periodic: false,
    periodicValue: 1,
    periodicUnit: "s",
    oneShotDelay: 0,
    counter: 0,
  };

  onInit = (initialState) => {
    if (initialState) {
      this.setState({
        periodic: initialState.periodic,
        periodicValue: initialState.periodicValue,
        periodicUnit: initialState.periodicUnit,
        oneShotDelay: initialState.oneShotDelay,
        timerIsRunning: initialState.running,
        counter: initialState.counter,
      });
    }
  };

  onNotification = (service, notification) => {
    const { running, counter } = notification;
    const updatedState = {};
    if (running !== undefined) {
      updatedState.timerIsRunning = running;
    }
    if (counter !== undefined) {
      updatedState.counter = counter;
    }
    this.setState(updatedState);
  };

  renderPeriodic = (service) => {
    const buttonStyle = s(t.m1, t.uc, t.fs12, t.ls1);
    return (
      <div>
        <InputField
          type="number"
          label="interval"
          value={this.state.periodicValue}
          onChange={async (_, { value }) => {
            await service.configure({ periodicValue: Number(value) });
            this.setState({ periodicValue: Number(value) });
          }}
        />
        <SelectorField
          style={t.mt3}
          label="unit"
          options={{
            ms: "milliseconds",
            s: "seconds",
            m: "minutes",
            h: "hours",
            d: "days",
          }}
          value={this.state.periodicUnit}
          onChange={async (_ev, { value }) => {
            await service.configure({ periodicUnit: value });
            this.setState({ periodicUnit: value });
          }}
        />
        <Button.Group widths="10" style={t.mt3}>
          <Button
            style={buttonStyle}
            onClick={() =>
              service.configure({
                periodic: true,
                periodicValue: this.state.periodicValue,
                periodicUnit: this.state.periodicUnit,
                start: true,
              })
            }
            disabled={!!this.state.timerIsRunning}
          >
            Start
          </Button>
          <Button
            style={buttonStyle}
            onClick={() => service.configure({ stop: true })}
            disabled={!this.state.timerIsRunning}
          >
            Stop
          </Button>
        </Button.Group>
      </div>
    );
  };

  renderOneShot = (service) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        paddingBottom: 3,
      }}
    >
      <InputField
        type="number"
        label="delay"
        unit="msec"
        value={this.state.oneShotDelay || "0"}
        onChange={async (_, { value: oneShotDelay }) => {
          await service.configure({ oneShotDelay });
          this.setState({ oneShotDelay });
        }}
      />
      <Button
        style={s(t.w100, t.uc, t.ls1, t.fs12)}
        onClick={() =>
          service.configure({
            periodic: false,
            start: true,
          })
        }
      >
        Trigger
      </Button>
    </div>
  );

  renderCounter = (service) => (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: 3 }}>
      <InputField
        type="number"
        label="Counter"
        value={this.state.counter}
        onChange={(_, { value: count }) => service.configure({ count })}
      />
      <Button
        style={s(t.w100, t.uc, t.ls1, t.fs12)}
        onClick={() =>
          service.configure({
            periodic: false,
            start: true,
          })
        }
      >
        Trigger
      </Button>
    </div>
  );

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: "periodic", render: this.renderPeriodic },
          { name: "one-shot", render: this.renderOneShot },
          { name: "counter", render: this.renderCounter },
        ]}
        initialSegment={(service) =>
          service.periodic ? "periodic" : "one-shot"
        }
      />
    );
  }
}

const { serviceName, serviceId, service: Timer } = TimerDescriptor;
const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Timer(app, board, descriptor, id),
  createUI: TimerUI,
};

export default descriptor;
