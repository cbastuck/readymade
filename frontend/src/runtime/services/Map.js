import React, { Component } from 'react';
import {
  Input,
  Button,
  Checkbox,
} from 'semantic-ui-react';

import evilEval from '../../evilEval';
import ServiceUI from './ServiceUI';

import './Map.css';

const serviceId = 'hookup.to/service/map';
const serviceName = 'Map';

const newProperty = { key: 'value' };

class MapUI extends Component {
  state = {
    template: {},
    addProperty: null,
    conditionEnabled: false,
  };

  onInit(initialState) {
    const { template, condition } = initialState;
    this.setState({
      template,
      condition,
      conditionEnabled: !!condition,
    });
  }

  renderMapping = service => {
    const vspace = { marginBottom: 5 }
    return (
      <div>
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
                onKeyPress={e => e.key === 'Enter' && service.configure({ template: this.state.template })}
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
            Add Property
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

  renderCondition = service => {
    return (
      <div style={{ textAlign: 'left'}}>
        <Checkbox
          label="Apply Condition"
          checked={this.state.conditionEnabled}
          onChange={
            (_, { checked: conditionEnabled }) => {
              this.setState({ conditionEnabled });
              service.configure({ condition: conditionEnabled ? this.state.condition : null });
            }
          }
        />
        <Input
          style={{ margin: "5px 0px", width: '100%' }}
          type="text"
          disabled={!this.state.conditionEnabled}
          value={this.state.condition || ''}
          onChange={(_, { value }) => { 
              this.setState({ condition: value })
          }}
          onKeyPress={
            e => e.key === 'Enter' && 
            service.configure({ condition: this.state.condition })
          }
        />
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Mapping', render: this.renderMapping },
          { name: 'Condition', render: this.renderCondition }
        ]}
      />
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
    const { template, condition } = config;
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

    if (condition !== undefined) {
      this.condition = condition;
    }
  }

  process(params) {
    const mapper = x => {
      if (this.condition) {
        if (!evilEval(this.condition, x)) {
          return x; // no map when condition present and failing
        }
      }
      try {
        const evaluatedTerms = Object.keys(this.terms).reduce(
          (p, key) => ({ 
            ...p, 
            [key]: evilEval(this.terms[key], x),
          }),
          {}
        );
        return {
          ...this.template,
          ...evaluatedTerms,
        }
      } catch(error) {
        return x; // do not map the input - there was an error
      }
    };

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
