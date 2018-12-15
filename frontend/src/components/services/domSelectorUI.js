import React, { Component } from 'react';
import {
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class DomSelectorUI extends Component {
  state = {
    query: ''
  };

  render() {
    const { service } = this.props;
    return (
      <div
        style={{
          margin: 10
        }}
      >
        <div
          style={{
            marginBottom: 10
          }}
        >
          <Label>
            Query
          </Label>
          <Input
            placeholder='Query'
            value={this.state.query}
            style={{ width: '70%' }}
            onChange={(_, data) => this.setState({ query: data.value })}
          />
        </div>

        <Button
          style={{ width: '95%' }}
          onClick={async () => {
            const config = await configureService(service, this.state);
            this.setState({ ...config });
          }}
        >
          Configure
        </Button>
      </div>
    );
  }
}
