import React, { Component } from 'react';
import {
  Input,
  Button,
  Label,
  Select,
} from 'semantic-ui-react';
import moment from 'moment';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/browser-timer';
const serviceName = 'Timer';

class TimerUI extends Component {
  state = {
    timerIsRunning: false,
    periodic: false,
    periodicValue: 1,
    periodicUnit: 's'
  };

  onInit(initialState) {
    this.setState({
      periodicValue: initialState.periodicValue,
      periodicUnit: initialState.periodicUnit,
    });
  }

  renderPeriodic = service => {
    return (
      <div>
        <Input
          type="number"
          label="Interval"
          value={this.state.periodicValue}
          onChange={(_, { value }) => this.setState({ periodicValue: Number(value) })}
        />
        <div style={{ textAlign: 'left', marginTop: 5, width: '100%' }}>
          <Label size="large" style={{ minWidth: 70, borderRadius: 2 }}>Unit</Label>
          <Select
            style={{ margin: 5 }}
            compact
            options={[
              { key: 'ms', value: 'ms', text: 'milliseconds' },
              { key: 's', value: 's', text: 'seconds' },
              { key: 'm', value: 'm', text: 'minutes' },
              { key: 'h', value: 'h', text: 'hours' },
              { key: 'd', value: 'd', text: 'days' },
            ]}
            value={this.state.periodicUnit}
            onChange={
              (_ev, { value }) => 
                this.setState({ periodicUnit: value })
            }
          />
        </div>
        <Button.Group 
          widths="10" 
          style={{ marginTop: 10 }}
        >
          <Button
            style={{ margin: 1 }}
            onClick={() => service.configure({ 
              periodic: true,
              periodicValue: this.state.periodicValue,
              periodicUnit: this.state.periodicUnit,
            })}
            disabled={this.state.timerIsRunning}
          >
            Start
          </Button>
          <Button
            style={{ margin: 1 }}
            onClick={() => service.configure({ stop: true })}
            disabled={!this.state.timerIsRunning}
          >
            Stop
          </Button>      
        </Button.Group>
      </div>
    );
  }

  renderOneShot = service => (
    <Button
      onClick={() => service.configure({ 
        periodic: false,
      })}
    >
      Trigger 
    </Button>
  )

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        onTimer={service => 
          (!!service.timer !== this.state.timerIsRunning) && 
          this.setState({ timerIsRunning: !!service.timer })
        }
        segments={[
          { name: 'periodic', render: this.renderPeriodic },
          { name: 'one-shot', render: this.renderOneShot },
        ]}
      />
    );
  }
}

class Timer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.periodic = false;
    this.periodicValue = 1;
    this.periodicUnit = 's';
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  configure(config) {
    if (config.stop) {
      this.clearTimer();
    } else {
      this.clearTimer(); // TODO: 
      this.count = 0;
      this.periodicValue = config.periodicValue || 1;
      this.periodicUnit = config.periodicUnit || 's';
      this.periodic = config.periodic;
      const process = this.process.bind(this);
      if (this.periodic) {
        const timeBetween = moment.duration(this.periodicValue, this.periodicUnit);
        this.timer = setInterval(process, timeBetween.asMilliseconds());
        if (config.immediate) {
          setImmediate(process);
        }
      } else {
        setTimeout(process, 0)
      }
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  process() {
    this.app.next(this, { triggerCount: ++this.count });
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Timer(app, board, descriptor, id),
  createUI: TimerUI
};

export default descriptor;
