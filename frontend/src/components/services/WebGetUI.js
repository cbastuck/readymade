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

export default class WebGetUI extends Component {
  state = {
    url: undefined,
    preserveInput: false
  };

  componentDidMount() {
    this.update();
  }

  update = async() => {
    const config = await getServiceConfiguration(this.props.service);
    const { url, preserveInput } = config;
    this.setState({ url, preserveInput });
  }

  render() {
    const { service } = this.props;
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
            URL
          </Label>
          <Input
            style={{ marginLeft: 10 }}
            onChange={(_, { value }) => {
              this.setState(
                { url: value },
                async () => {
                  await configureService(service, this.state);
                  this.update();
                }
              )
            }}
            value={this.state.url || ''}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 70 }}>
            Preserve Input
          </Label>
          <Checkbox
            style={{ marginLeft: 10 }}
            onChange={(_, { checked }) => {
              this.setState(
                { preserveInput: checked },
                async () => {
                  await configureService(service, this.state);
                  this.update();
                }
              )
            }}
            checked={this.state.preserveInput}
          />
        </div>
      </div>
   );
  }
}
