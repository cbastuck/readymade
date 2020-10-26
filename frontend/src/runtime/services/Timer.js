import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';
import moment from 'moment';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
import { s, t } from '../../styles'; 

const serviceId = 'hookup.to/service/timer';
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

  onInit = initialState => {
    this.setState({
      periodic: initialState.periodic,
      periodicValue: initialState.periodicValue,
      periodicUnit: initialState.periodicUnit,
      oneShotDelay: initialState.oneShotDelay,
      timerIsRunning: !!initialState.timer,
    });
  }
  
  onNotification = (service, notification) => {
    const { running } = notification
    if (running !== undefined) {
      this.setState({ timerIsRunning: running });
    }
  }

  renderPeriodic = service => {
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
          label="unit"
          options={{
            ms: 'milliseconds',
            s: 'seconds',
            m: 'minutes',
            h: 'hours',
            d: 'days',
          }}
          value={this.state.periodicUnit}
          onChange={async (_ev, { value }) => {
            await service.configure({ periodicUnit: value });
            this.setState({ periodicUnit: value });
          }}
        />
        <Button.Group 
          widths="10" 
          style={{ marginTop: 10 }}
        >
          <Button
            style={buttonStyle}
            onClick={() => service.configure({ 
              periodic: true,
              periodicValue: this.state.periodicValue,
              periodicUnit: this.state.periodicUnit,
              start: true,
            })}
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
  }

  renderOneShot = service => (
    <div>
      <InputField 
        type="number" 
        label="delay"
        unit="msec"
        value={this.state.oneShotDelay || '0'}
        onChange={async (_, { value: oneShotDelay }) => {
          await service.configure({ oneShotDelay });
          this.setState({ oneShotDelay });
        }}
      />
      <Button
        style={s(t.w100, t.uc, t.ls1, t.fs12)}
        onClick={() => service.configure({ 
          periodic: false,
          start: true,
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
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'periodic', render: this.renderPeriodic },
          { name: 'one-shot', render: this.renderOneShot },
          // { name: 'counter', render: this.renderCounter },
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
      this.app.notify(this, { running: false });
    }
  }

  configure(config) {
    const { 
      periodicValue,
      periodicUnit,
      periodic,
      oneShotDelay,
      immediate,
      counter,
      // commands
      stop,
      start,
    } = config;
    let doStop = stop, doStart = start;
    if (periodicValue !== undefined) {
      this.periodicValue = periodicValue;
      doStart = true;
    }
    
    if (periodicUnit !== undefined) {
      this.periodicUnit = periodicUnit;
      doStart = true;
    }
    
    if (periodic !== undefined) {
      this.periodic = periodic;
      doStart = true;
    }

    if (oneShotDelay !== undefined) {
      this.oneShotDelay = oneShotDelay;
    }

    if (counter !== undefined) {
      this.count = counter;
    }
    
    const process = () => this.app.next(this, this.nextTimerArgument());
    if (doStart) {
      if (this.periodic) {
        this.clearTimer();
        const timeBetween = moment.duration(this.periodicValue, this.periodicUnit);
        this.timer = setInterval(process, timeBetween.asMilliseconds());
        if (immediate) {
          setImmediate(process);
        }
      } else {
        if (this.timer) {
          this.clearTimer();
        }
        if (immediate) {
          setImmediate(process);
        } else {
          setTimeout(process, this.oneShotDelay);
        }
      }
    } else if (doStop) {
      this.clearTimer();
    }
    this.app.notify(this, { running: !!this.timer });
  }

  destroy() {
    this.clearTimer();
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
