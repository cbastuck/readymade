import React, { Component } from 'react';
import {
  Input,
  Label,
  Checkbox,
} from 'semantic-ui-react';

import {
  configureService,
  getServiceConfiguration
} from '../../core/actions';

const lineStyle = {
  textAlign: 'left',
  margin: 10,
};

export default class OutputUI extends Component {
  state = {
    name: 'out',
    active: false
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    this.setState({ name: config.endpoint, active: config.active });
  }

  render() {
    const { service, board } = this.props;
    return (
      <div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>
              Name
          </Label>
          <Input
            style={{ maxWidth: 170, marginLeft: 5 }}
            value={this.state.name}
            onChange={(_, { value }) => this.setState({ name: value })}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>
              Active
          </Label>
          <Checkbox
            style={{ padding: '5px 5px' }}
            slider
            checked={this.state.active}
            onChange={async (_, { checked }) => {
              await configureService(board, service, {
                active: checked,
                name: this.state.name
              });
              this.update();
            }}
          />
        </div>
        {
          this.state.active && (
            <div style={lineStyle}>
              <Label style={{ width: 70 }}>
                Output
              </Label>
              <span style={{ padding: '5px 5px' }}>
                <a
                  href={`${window.location.origin}/api/${board}/${this.state.name}`}
                  target="blank"
                >
                  Link
                </a>
              </span>
            </div>
          )
        }
      </div>
    );
  }

}
