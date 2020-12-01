import React, { Component } from 'react';
import {
  Input,
  Button,
  Checkbox,
} from 'semantic-ui-react';

import MapDescriptor, { 
  serviceName, 
  serviceId,
} from 'services/Map';

// import evilEval from '../../evilEval';
import InputLabelValue from '../../components/shared/InputLabelValue';

import ServiceUI from './ServiceUI';

const newProperty = { key: 'value' };

class MapUI extends Component {
  state = {
    template: {},
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

  onNotification = (service, notification) => {
    const { template } = notification;
    if (template !== undefined) {
      this.setState({ template });
    }
  }

  renderMapping = service => {
    const { template={} } = this.state;
    return (
      <div>
        {
          Object.keys(template)
            // TODO: support nested objects
            .filter(key => typeof template[key] !== 'object')
            .map((key, idx) => (
              <InputLabelValue
                key={`${service.uuid}-${key}-${idx}`}
                label={key}
                labelPosition="left"
                value={template[key]}
                onCommit={({ label: newKey, value }) => { 
                  const updatedTemplate = Object.keys(template).reduce(
                    (all, cur) => (cur !== key) ? 
                        { ...all, [cur]: template[cur] } : // this is the input that changed
                        (newKey !== '' ? { ...all, [newKey]: value } : all), // empty key means deleting the item
                    {}
                  );
                  service.configure({ template: updatedTemplate });
                  this.setState({ template: updatedTemplate });
                }}
              />
            ))
        }
        <div>
          <Button
            style={{ 
              width: '100%', 
              marginTop: 1,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}
            onClick={() => this.setState({ 
                template: {
                  ...this.state.template,
                  ...newProperty,
                }
              })
            }
          >
            Add Property
          </Button>
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
        onNotification={this.onNotification.bind(this)}
        segments={[
          { name: 'Mapping', render: this.renderMapping },
          // { name: 'Condition', render: this.renderCondition }
        ]}
      />
    );
  }
}
/*
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
      this.app.notify(this, { template });
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
        const keys = Object.keys(this.terms);
        // map to scalar value (not an object) if only an '=', i.e. empty string
        if (keys.length === 1 && keys[0] === '') {
          return evilEval(this.terms[keys[0]], x);
        }
        const evaluatedTerms = keys.reduce(
          (p, key) => {
            const y = evilEval(this.terms[key], x);
            return { 
              ...p, 
              [key]: y,
            };
          },
          {}
        );
        return {
          ...this.properties,
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
*/

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new MapDescriptor.service(app, board, descriptor, id),
  createUI: MapUI
};

export default descriptor;
