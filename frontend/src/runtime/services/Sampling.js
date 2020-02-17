import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import jstat from 'jstat';

import ServiceUI from './ServiceUI';

const serviceId = 'hookup.to/service/sampling';
const serviceName = 'Sampling';

function isJSON(x) {
  try {
    return JSON.parse(x);
  } catch(err) {
    return undefined;
  }
}

class SamplingUI extends Component {
  state = {};

  onInit(initialState) {
    const newState = {};
    const { mean, std } = initialState;
    if (mean !== undefined) {
      newState.mean = JSON.stringify(mean);
    }
    if (std !== undefined) {
      newState.std = JSON.stringify(std);
    }

    this.setState(newState);
  }

  render() {
    const marginStyle = { margin: '5px 5px' };
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div style={marginStyle}>
            <Input
              style={marginStyle}
              type="text"
              value={this.state.mean}
              label="Mean"
              onChange={(_, { value: mean }) => this.setState({ mean })}
              onBlur={() => service.mean = isJSON(this.state.mean)}
            />
            <Input
              style={marginStyle}
              type="text"
              value={this.state.std}
              label="Std"
              onChange={(_, { value: std }) => this.setState({ std })}
              onBlur={() => service.std = isJSON(this.state.std)}
            />
            <Input
              style={marginStyle}
              type="text"
              value={this.state.key}
              label="Key"
              onChange={(_, { value: key }) => this.setState({ key })}
              onBlur={() => service.key = this.state.key}
            />
            <Input
              style={marginStyle}
              type="text"
              value={this.state.value}
              label="Value"
              onChange={(_, { value }) => this.setState({ value })}
              onBlur={() => service.value = this.state.value}
            />
          </div>
        )
      }
      </ServiceUI>
    );
  }
}

class Sampling {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.mean = [0.5, 0.5];
    this.std = [0.1, 0.1];
  }

  configure(config) {
    if (config.mean !== undefined) {
      this.mean = config.mean;
    }

    if (config.std !== undefined) {
      this.std = config.std;
    }    
  }

  sample(mx, sx) {
    return jstat.normal.sample(mx, sx);
  }

  process(params) {
    if (!this.mean || !this.std ) {
      return params;
    }

    const n = this.mean.length;
    if (n !== this.std.length) {
      return params;
    }

    const sample = new Array(n).fill(0).map(
      (_, idx) => this.sample(this.mean[idx], this.std[idx])
    );
    
    if (!params) {
      return sample;
    }

    if (Array.isArray(params)) {
      return [...params, sample];
    }
    return [params, sample];
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Sampling(app, board, descriptor, id),
  createUI: SamplingUI
};

export default descriptor;
