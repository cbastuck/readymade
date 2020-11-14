import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
import { s, t } from '../../styles'; 

import TimerDescriptor from 'services/Timer';

console.log('TimerDescriptor',TimerDescriptor)

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
    if (initialState) {
      this.setState({
        periodic: initialState.periodic,
        periodicValue: initialState.periodicValue,
        periodicUnit: initialState.periodicUnit,
        oneShotDelay: initialState.oneShotDelay,
        timerIsRunning: !!initialState.timer,
      });
    }
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
          style={t.mt3}
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
          style={t.mt3}
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
        style={s(t.w100, t.uc, t.ls1, t.fs12, t.mt2)}
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

const { serviceName, serviceId, service: Timer } = TimerDescriptor;
const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Timer(app, board, descriptor, id),
  createUI: TimerUI
};

export default descriptor;
