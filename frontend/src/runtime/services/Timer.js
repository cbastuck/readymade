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
    periodicUnit: 's',
    oneShotDelay: 0,
    resetCounterValue: 0,
  };

  onInit(initialState) {
    this.setState({
      periodic: initialState.periodic,
      periodicValue: initialState.periodicValue,
      periodicUnit: initialState.periodicUnit,
      oneShotDelay: initialState.oneShotDelay,
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
    <div>
      <Input 
        style={{ marginBottom: 10 }}
        label="Delay"
        type="number"
        value={this.state.oneShotDelay || 0}
        onChange={(_, {value: oneShotDelay}) => {
          this.setState({ oneShotDelay });
          service.configure({ oneShotDelay});
        }}
      />
      <Button
        style={{ width: '100%' }}
        onClick={() => service.configure({ 
          periodic: false,
          immediate: true,
        })}
      >
        Trigger 
      </Button>
    </div>
  )

  renderCounter = service => (
    <div>
      <Input
        style={{ marginBottom: 10 }}
        label="Counter"
        type="number"
        value={this.state.resetCounterValue || 0}
        onChange={(_, { value: resetCounterValue }) => 
          this.setState({ resetCounterValue })
        }
      />
      <Button
        style={{ width: '100%' }}
        onClick={() => 
          service.configure({ 
            counter: this.state.resetCounterValue
          })
        }
      >
        Reset
      </Button>
    </div>
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
          { name: 'counter', render: this.renderCounter },
        ]}
        initialSegment={() => this.state.periodic ? 'periodic' : 'one-shot'}
      />
    );
  }
}

class Timer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.count = 0;
    this.periodic = false;
    this.periodicValue = 1;
    this.periodicUnit = 's';
    this.oneShotDelay = 0;
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.count = 0;
    }
  }

  configure(config) {
    if (config.stop) {
      this.clearTimer();
    } else {
      const { 
        periodicValue,
        periodicUnit,
        periodic,
        oneShotDelay,
        immediate,
        counter
      } = config;

      if (periodicValue !== undefined) {
        this.periodicValue = periodicValue;
      }
      
      if (periodicUnit !== undefined) {
        this.periodicUnit = periodicUnit;
      }
      
      if (periodic !== undefined) {
        this.periodic = periodic;
      }

      if (oneShotDelay !== undefined) {
        this.oneShotDelay = oneShotDelay;
      }

      if (counter !== undefined) {
        this.count = counter;
      }
      
      const process = () => this.app.next(this, this.nextTimerArgument());
      if (this.periodic) {
        this.clearTimer();
        const timeBetween = moment.duration(this.periodicValue, this.periodicUnit);
        this.timer = setInterval(process, timeBetween.asMilliseconds());
        if (immediate) {
          setImmediate(process);
        }
      } else {
        if (immediate) {
          setImmediate(process);
        }
      }
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  nextTimerArgument(params = {}) {
    return { ...params, triggerCount: ++this.count };
  }

  async process(params) {
    if (this.periodic || this.oneShotDelay === undefined) {
      return params;
    } 
    if (this.isSleeping) {
      console.warn('Processing timer service while sleeping ... process dropped')
      clearTimeout(this.sleeping);
      this.sleeping = undefined;
      return params;
    }
    const sleep = () => new Promise(resolve => {
      this.isSleeping = setTimeout(resolve, this.oneShotDelay);
    });
    await sleep();
    this.isSleeping = undefined;
    return this.nextTimerArgument(params);
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
