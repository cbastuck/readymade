import React, { Component } from 'react';
import {
  Input,
  Checkbox,
  Dropdown,
  Button
} from 'semantic-ui-react';
import moment from 'moment';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/browser-timer';
const serviceName = 'Timer';

const lineStyle = {
  textAlign: 'left',
  margin: 10,
};


class TimerUI extends Component {
  state = {
    periodic: false,
    periodicValue: 1,
    periodicUnit: 's'
  };

  onInit(initialState) {
    this.setState({
      periodic: initialState.periodic,
      periodicValue: initialState.periodicValue,
      periodicUnit: initialState.periodicUnit,
    });
  }

  render() {
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div>
            <div style={lineStyle}>
              <Checkbox
                label="Periodic"
                onChange={(_, { checked }) => this.setState({ periodic: checked })}
                checked={this.state.periodic}
              />
            </div>
            {
              this.state.periodic && (
                <div style={lineStyle}>
                  <Input
                    type="number"
                    style={{ maxWidth: 80, marginRight: 5 }}
                    value={this.state.periodicValue}
                    onChange={(_, { value }) => this.setState({ periodicValue: Number(value) })}
                  />
                  <Dropdown
                    className="left"
                    style={{ margin: 5 }}
                    placeholder='Unit'
                    options={[
                      { key: 's', value: 's', text: 'seconds' },
                      { key: 'm', value: 'm', text: 'minutes' },
                      { key: 'h', value: 'h', text: 'hours' },
                      { key: 'd', value: 'd', text: 'days' },
                    ]}
                    value={this.state.periodicUnit}
                    onChange={
                      (_ev, { value }) => this.setState({ periodicUnit: value })}
                  />
                </div>
              )
            }
            <div
                style={{
                  ...lineStyle,
                  margin: '15px 10px',
                  textAlign: 'center',
                }}
              >
                <Button
                  onClick={() => service.configure({ 
                    periodic: this.state.periodic,
                    periodicValue: this.state.periodicValue,
                    periodicUnit: this.state.periodicUnit,
                  })}
                  style={{ marginRight: 10 }}
                >
                { this.state.periodic ? 'Start' : 'One Shot' }
                </Button>
                <Button
                  onClick={() => service.configure({ stop: true })}
                >
                  Stop
                </Button>
              </div>
            </div>
          )
        }
      </ServiceUI>
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
