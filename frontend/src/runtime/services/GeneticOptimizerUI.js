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
    const dimensionality = initialState.dimensionality;
    const ttl = initialState.ttl;
    this.setState({
      dimensionality,
      ttl,
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
              type="number"
              value={this.state.dimensionality}
              onChange={(_, { value }) => this.setState({ dimensionality: Number(value) })}
              label="Dimensionality"
              style={inputStyle}
            />
            <Input
              type="number"
              value={this.state.ttl}
              onChange={(_, { value }) => this.setState({ ttl: Number(value) })}
              label="Time to Live"
              style={inputStyle}
            />
          </div>
        )
      }
      </ServiceUI>
    );
  }
}
