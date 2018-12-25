import React, { Component } from 'react';
import {
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import {
  configureService
} from '../../core/actions';

export default class EventStreamUI extends Component {
  state = {
    url: 'https://stream.wikimedia.org/v2/stream/recentchange'
  };

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
      padding: 10
    };

    return (
      <div>
        <div
          style={lineStyle}
        >
          <Label
            style={{ width: 60 }}
          >
            Stream
          </Label>
          <Input
            value={this.state.url}
          />
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Button
            style={{ width: 210 }}
            onClick={async () => {
              const config = await configureService(service, this.state);
              this.setState({ ...config });
            }}
          >
            Configure
          </Button>
        </div>
      </div>
    );
  }
}
