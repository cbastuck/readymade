import React, { Component } from 'react';
import {
  Input,
  Checkbox,
  Dropdown,
  Button
} from 'semantic-ui-react';

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
    periodicUnit: 's',
    scheduled: false,
  };

  render() {
    return (
      <ServiceUI {...this.props}>
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
                    onChange={(_, { value }) => this.setState({ periodicValue: value })}
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
                  onClick={() => service.configure({ periodic: this.state.periodic })}
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
      if (config.periodic) {
        this.timer = setInterval(this.process.bind(this), 1000);
      } else {
        setTimeout(this.process.bind(this), 0)
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
    console.log('Processing Timer');
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
