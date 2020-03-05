import React, { Component } from 'react';
import {
  Input,
  Label,
  Checkbox,
  Dropdown,
  Button
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';

export default class GeneticOptimizerUI extends Component {
  state = {
  };

  onInit(initialState) {
    const { ttl, dataRoot } = initialState;
    this.setState({
      ttl,
      dataRoot,
    });
  }

  render() {
    const inputStyle = { margin: '10px 5px' };
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div style={{ textAlign: 'left' }}>
            <Input
              type="text"
              value={this.state.dataRoot || ''}
              onChange={(_, { value: dataRoot }) => {
                this.setState({ dataRoot });
                service.dataRoot = dataRoot;
              }}
              label="Root"
              style={inputStyle}
            />
            <Input
              type="number"
              value={this.state.ttl}
              onChange={(_, { value }) => this.setState({ ttl: Number(value) })}
              label="TTL"
              style={inputStyle}
            />
          </div>
        )
      }
      </ServiceUI>
    );
  }
}
