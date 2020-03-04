import React, { Component } from 'react';
import {
  Input,
  Checkbox,
} from 'semantic-ui-react';

import jstat from 'jstat';

import ServiceUI from './ServiceUI';
import './Sampling.css';

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
  state = {
    wrapSample: false,
  };

  onInit(initialState) {
    const newState = {};
    const { mean, std, annotations, root } = initialState;
    if (mean !== undefined) {
      newState.mean = JSON.stringify(mean);
    }
    if (std !== undefined) {
      newState.std = JSON.stringify(std);
    }
    if (annotations !== undefined) {
      newState.annotations = annotations;
    }
    if (root !== undefined) {
      newState.root = root;
    }

    this.setState({ 
      ...newState, 
      wrapSample: !!newState.root 
    });
  }

  render() {
    const marginStyle = { margin: '5px 5px' };
    const vspace = { marginBottom: 5 }
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div className="sampling-service" style={marginStyle}>
            <Input
              style={{ ...vspace, width: '100%' }}
              type="text"
              value={this.state.mean || ''}
              label="Mean"
              labelPosition="left"
              onChange={(_, { value: mean }) => this.setState({ mean })}
              onBlur={() => service.mean = isJSON(this.state.mean)}
            />
            <Input
              style={{ ...vspace, width: '100%' }}
              type="text"
              value={this.state.std || ''}
              label="Std"
              labelPosition="left"
              onChange={(_, { value: std }) => this.setState({ std })}
              onBlur={() => service.std = isJSON(this.state.std)}
            />
            <div style={{ textAlign: 'left' }}>
              <Checkbox
                checked={this.state.wrapSample}
                label="Wrap Sample?"
                onChange={(_, { checked }) => {
                  const root = !checked ? undefined : this.state.root;
                  service.root = root;
                  this.setState({ wrapSample: checked, root })
                }}
              />
              <Input
                style={{ ...vspace, width: '100%' }}
                type="text"
                value={this.state.root || ''}
                label="Root"
                labelPosition="left"
                onChange={(_, { value: root }) => this.setState({ root })}
                onBlur={() => service.root = this.state.root}
                disabled={!this.state.wrapSample}
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="section-header">Annotations</div>
              {
                this.state.annotations &&
                Object.keys(this.state.annotations).map((key, i) => (
                  <div key={`sample-annotation-${service.uuid}-${i}`}>
                    <Input
                      style={{ ...vspace, width: '100%' }}
                      type="text"
                      value={key}
                      label="Key"
                      labelPosition="left"
                      onChange={(_, { value: newKey }) => this.setState({ 
                        annotations: Object.keys(this.state.annotations)
                          .reduce(
                            (all, oldKey) => {
                              // replace the old key with the new key preserving the value
                              const k = (oldKey === key) ? newKey : oldKey;
                              return { ...all, [k]: this.state.annotations[oldKey] };
                            },
                            {}
                          )
                      })}
                      onBlur={() => service.annotations = this.state.annotations}
                    />
                    <Input
                      style={{ ...vspace, width: '100%' }}
                      type="text"
                      value={this.state.annotations[key]}
                      label="Value"
                      labelPosition="left"
                      onChange={(_, { value }) => 
                        this.setState({ 
                          annotations: { 
                            ...this.state.annotations, 
                            [key]: value
                          }
                        })
                      }
                      onBlur={() => service.annotations = this.state.annotations}
                    />
                  </div>
                ))
              }
            </div>
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
    this.annotations = undefined;
    this.root = undefined;
  }

  configure(config) {
    const { mean, std, annotations, root } = config;
    if (mean !== undefined) {
      this.mean = mean;
    }

    if (std !== undefined) {
      this.std = std;
    }

    if (annotations !== undefined) {
      this.annotations = annotations;
    }

    if (root !== undefined) {
      this.root = root;
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

    // wrap sample in object in case root or annotations are specified
    const result = this.annotations ? 
      { ...this.annotations, [this.root || 'sample']: sample } : 
      (this.root ? { [this.root]: sample } : sample);
    
    if (!params) {
      return result;
    }

    if (Array.isArray(params)) {
      return [...params, result];
    }

    return [params, result];
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
