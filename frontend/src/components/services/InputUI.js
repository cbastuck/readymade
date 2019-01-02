import React, { Component } from 'react';
import {
  Dropdown,
  Input,
  Label,
  Checkbox
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

export default class InputUI extends Component {
  state = {
    op: '',
    path: '',
    redirect: ''
  };

  componentDidMount() {
    this.update();
  }

  update = async() => {
    const { board, service } = this.props;
    const conf = await getServiceConfiguration(board, service);
    const op = conf && conf.op && conf.op.toUpperCase();
    const path = conf && conf.path;
    const query = conf && conf.selector && conf.selector.query;
    const active = conf && conf.active;
    const redirect = conf && conf.redirect;
    this.setState({
      op: op,
      path: path,
      selector: {
        query: query
      },
      active,
      redirect
    });
  }

  render() {
    const { board, service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      margin: '8px 10px',
    };

    return (
      <div
        style={{ marginBottom: 15 }}
      >
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>
            Method
          </Label>
          <Dropdown
            className="left"
            style={{ marginLeft: 5 }}
            placeholder='Operation'
            options={[
              { key: 'GET', value: 'GET', text: 'GET' },
              { key: 'POST', value: 'POST', text: 'POST' },
              { key: 'DELETE', value: 'DELETE', text: 'DELETE' },
              { key: 'PUT', value: 'PUT', text: 'PUT' },
            ]}
            value={this.state.op}
            onChange={
              (_ev, data) => this.setState({ op: data.value, active: false })}
          />
        </div>

        <div
          style={lineStyle}
        >
          <Label style={{ width: 70 }}>
            Path
          </Label>
          <Input
            placeholder='Path'
            value={this.state.path || ''}
            onChange={
              (_, data) => this.setState({ path: data.value, active: false })
            }
          />
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Label
            style={{ width: 70 }}
          >
            Redirect
          </Label>
          <Input
            onChange={async (_, { value }) => {
              this.setState(
                { redirect: value, active: false },
                async () => {
                  await configureService(board, service, this.state);
                  this.update();
                }
              )
            }}
            value={this.state.redirect || ''}
          />
        </div>
        <div
          style={{
            ...lineStyle,
          }}
        >
          <Label
            style={{ width: 70 }}
          >
            Active
          </Label>
          <Checkbox
            slider
            style={{ padding: '5px 5px' }}
            onChange={async (_, { checked }) => {
              this.setState(
                { active: checked },
                async () => {
                  await configureService(board, service, this.state);
                  this.update();
                }
              )
            }}
            checked={this.state.active}
            disabled={!this.state.op || !this.state.path}
          />
        </div>
        {
          this.state.active &&
          this.state.op === 'GET' &&  (
            <div
              style={{
                ...lineStyle,
                textAlign: 'right',
                margin: '10px 10px',
            }}>
              <a
                href={`/api/${service.board}/${this.state.path}?key=value`}
                target="blank"
                style={{
                  color: 'black',
                  padding: 5
                }}
              >
                Click to test
              </a>
            </div>
          )
        }
      </div>
   );
  }
}
