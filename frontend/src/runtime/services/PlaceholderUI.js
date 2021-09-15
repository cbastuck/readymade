import React, { Component } from 'react';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';
import { isFunction, filterPrivateMembers } from './helpers';

export default class PlaceholderUI extends Component {
  state = {
    properties: {},
  };

  extractProperties = service => {
    if (!service) {
      return {};
    }
    const additionalFiters = ['uuid', 'board'];
    return Object.keys(filterPrivateMembers(service))
      .filter(x => additionalFiters.indexOf(x) === -1)
      .filter(x => !isFunction(service[x]))
      .reduce(
        (all, key) => {
          const val = service[key]
          const t = typeof val;
          return {
            ...all,
            [key]: t === 'object' ? JSON.stringify(val) : val,
          };
        },
        {}
      ); 
  }

  onInit = initialState => {
    this.setState(
      { properties: this.extractProperties(initialState) }
    );
  }

  onNotification = (service, notification) => {
    const { properties } = this.state;
    this.setState({ 
      properties: {
        ...properties,
        ...this.extractProperties(notification),
      }
    });
  }

  renderMain = service => {
    const { properties } = this.state;
    return (
      <div 
        key={service.uuid} 
        id={service.uuid} 
        service={service} 
        style={{ minWidth: 200 }} 
      >
      { 
        Object.keys(properties).map(prop => {
          const val = properties[prop];
          const t = typeof val;
          return (
            <InputField
              key={`PlaceholderUI-${service.uuid}.${prop}`}
              label={prop}
              labelStyle={{ textTransform: 'none' }}
              value={val}
              onChange={(_, { value }) => {
                service.configure({ [prop]: value });
              }}
              type={t === 'string' ? 'text' : t}
              disabled={true}
            />
          );
        })
      } 
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'Main', render: this.renderMain },
        ]}
      />
    );
  }
  
} 