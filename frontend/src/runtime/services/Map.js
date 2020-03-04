import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import ServiceUI from './ServiceUI';
import './Map.css';

const serviceId = 'hookup.to/service/map';
const serviceName = 'Map';

function evalTerm(f, params) {
  if (f && params) {
    const scopedFunction = (term, params) => {
      return eval(term);
    };
    return scopedFunction.call(null, f, params);
  }
}

const newProperty = { key: 'value' };

class MapUI extends Component {
  state = {
    template: {},
    addProperty: null,
  };

  onInit(initialState) {
    const { template } = initialState;
    this.setState({
      template,
    });
  }

  render() {
    const marginStyle = { margin: '10px 5px' };
    const vspace = { marginBottom: 5 }
    return (
      <ServiceUI {...this.props} onInit={this.onInit.bind(this)}>
      {
        ({ service }) => (
          <div className="map-service" style={marginStyle}>
            {
              Object.keys(this.state.template || {})
                .map((key, idx) => (
                  <Input
                    key={`${service.uuid}-${idx}`}
                    style={{ ...vspace, width: '100%' }}
                    type="text"
                    value={this.state.template[key]}
                    onChange={(_, { value }) => { 
                      this.setState({
                        template: {
                          ...this.state.template,
                          [key]: value
                        }
                      })
                    }}
                    onBlur={service.configure({ template: this.state.template })}
                    label={key}
                    labelPosition="left"
                  />
                ))
            }
            {
              this.state.addProperty && (
                <Input 
                  style={{ ...vspace, width: '100%' }}
                  type="text"
                  label={this.state.addProperty.key}
                  value={this.state.addProperty.value}
                  onChange={(_, { value }) => { 
                    this.setState({ addProperty: {
                      key: value
                    } })
                  }}
                  
                />
              )
            }
            <div>
              <Button 
                style={{ width: this.state.addProperty ? '48%' : '100%' }}
                onClick={() => {
                  if (this.state.addProperty) {
                    // commit the new property
                    this.setState({ addProperty: null });
                  } else {
                    this.setState({ addProperty: newProperty });
                  }
                }}
              >
                Add
              </Button>
              {
                this.state.addProperty && (
                  <Button 
                    style={{ width: '48%' }}
                    onClick={() => this.setState({ addProperty: null })}
                  >
                    Cancel
                  </Button>
                )
              }
            </div>
          </div>
        )
      }
      </ServiceUI>
    );
  }
}

class Map {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { template } = config;
    if (template !== undefined) {
      this.terms = {};
      this.template = template;
      this.properties = Object.keys(template).reduce(
        (all, cur) => {
          const value = template[cur];
          if (cur[cur.length - 1] === '=') {
            // treated as a dynamic term not a static property
            this.terms[cur.substr(0, cur.length - 1)] = value;
            return all;
          } else {
            return { ...all, [cur]: value };
          }
        }, 
        {}
      );
    }
  }

  process(params) {
    const mapper = x => ({
      ...this.template,
      ...Object.keys(this.terms).reduce(
        (p, key) => ({ 
          ...p, 
          [key]: evalTerm(this.terms[key], x),
        }),
        {}
      )
    });

    if (Array.isArray(params)) {
      return params.map(mapper);
    }
    
    return mapper(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Map(app, board, descriptor, id),
  createUI: MapUI
};

export default descriptor;
