import React, { Component } from 'react';
import {
  Input,
  Button,
  Checkbox,
} from 'semantic-ui-react';

import { MapDescriptor } from 'services';  

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
      <div 
        style={{ 
          width: '100%', 
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {
          Object.keys(template)
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
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
              textAlign: 'center',
              width: '99%',
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
      <div style={{ textAlign: 'left' }}>
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

const descriptor = {
  serviceName: MapDescriptor.serviceName,
  serviceId:  MapDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new MapDescriptor.service(app, board, descriptor, id),
  createUI: MapUI
};

export default descriptor;
