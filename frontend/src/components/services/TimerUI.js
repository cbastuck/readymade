import React, { Component } from 'react';
import {
  Input,
  Label,
  Checkbox,
  Dropdown,
  Button
} from 'semantic-ui-react';

/*
import {
  DateInput,
  TimeInput,
} from 'semantic-ui-calendar-react';
*/

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

const lineStyle = {
  textAlign: 'left',
  margin: 10,
};

export default class TimerUI extends Component {
  state = {
    date: '',
    time: ''
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState(config);
  }

  scheduleTimer = async (optionalConfig) => {
    const config = optionalConfig || this.state;
    const { board, service } = this.props;

    await configureService(board, service, config);
    setTimeout(this.update, 500);
  }

  render() {
    return (
      <div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>
              Date
          </Label>
          {
          /*
          <DateInput
            closeOnMouseLeave={false}
            closable={true}
            name="date"
            placeholder="Date"
            value={this.state.date}
            iconPosition="left"
            onChange={(_, { value }) => this.setState({date: value })}
          />
          */
          }
        </div>
         <div style={lineStyle}>
          <Label style={{ width: 70 }}>
            Time
          </Label>
          {
          /*
          <TimeInput
            closeOnMouseLeave={false}
            closable={true}
            name="time"
            placeholder="Time"
            value={this.state.time}
            iconPosition="left"
            onChange={(_, { value }) => this.setState({ time: value })}
          />
          */
          }
        </div>
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
              margin: '15px 0px',
              textAlign: 'center',
            }}
          >
            <Button
              onClick={() => this.scheduleTimer()}
            >
              Schedule
            </Button>
            <Button
              onClick={() => this.scheduleTimer({})}
              disabled={!this.state.scheduled}
            >
              Stop
            </Button>
          </div>
      </div>
    );
  }
}
