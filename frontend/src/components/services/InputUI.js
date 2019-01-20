import React, { Component } from 'react';
import {
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
    url: 'https://stream.wikimedia.org/v2/stream/recentchange',
    active: false
  };

  componentDidMount() {
    this.update();
  }

  update = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    const newState = { active: config.active };
    if (config.url) {
      newState.url = config.url;
    }
    this.setState(newState);
  }

  render() {
    const { board, service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
      padding: 10
    };

    return (
      <div>
        <div style={lineStyle}>
          <Label style={{ width: 60 }}>
            Stream
          </Label>
          <Input
            value={this.state.url}
            onChange={(_, { value }) => {
              this.setState(
                { url: value, active: false },
                () => configureService(
                  board, service, { url: this.state.url, active: false }
                )
              );
            }}
          />
        </div>
        <div style={lineStyle}>
          <Label style={{ width: 60 }}>
            Active
          </Label>
          <Checkbox
            slider
            checked={this.state.active}
            style={{ marginLeft: 10 }}
            onChange={async (_, { checked }) => {
              await configureService(
                board, service, { url: this.state.url, active: checked }
              );
              this.setState({ active: checked });
            }}
          />
         </div>
      </div>
    );
  }
}
