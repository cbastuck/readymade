import React, { Component } from 'react';
import {
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class HTMLFilterUI extends Component {
  state = {
    query: ''
  };

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
    };
    return (
      <div
        style={lineStyle}
      >
        <div
          style={{
            marginBottom: 10
          }}
        >
          <Label
            style={{ width: 60 }}
          >
            Selector
          </Label>
          <Input
            placeholder='Query'
            value={this.state.query}
            style={{ width: 160 }}
            onChange={(_, data) => this.setState({ query: data.value })}
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
