import React, { Component } from 'react';

import ServiceUI from './ServiceUI';
import InputField from '../../components/shared/InputField';
import { filterPrivateMembers } from './helpers';

export default class PlaceholderUI extends Component {
  state = {
    properties: {},
  };

  extractProperties = service => {
    const additionalFiters = ['uuid', 'board'];
    return Object.keys(filterPrivateMembers(service))
      .filter(x => additionalFiters.indexOf(x) === -1)
      .filter(x => {
        const t = typeof service[x];
        return t === 'string' || t === 'number';
      })
      .reduce(
        (all, key) => ({
          ...all,
          [key]: service[key],
        }),
        {}
      ); 
  }

  onInit = initialState => {
    this.setState({ 
      properties: this.extractProperties(initialState)
    });
  }

  onNotification = (service, notification) => {
    this.setState({ 
      properties: {
        ...this.state.properties,
        ...notification
      }
    });
  }

  renderMain = service => (
    <div 
      key={service.uuid} 
      id={service.uuid} 
      service={service} 
      style={{ minWidth: 200 }} 
    >
    { 
      Object.keys(this.state.properties).map(prop => (
        <InputField
          key={`PlaceholderUI-${service.uuid}.${prop}`}
          label={prop}
          value={this.state.properties[prop]}
          onChange={(_, { value }) => {
            service.configure({ [prop]: value });
          }}
        />
      ))
    } 
    </div>
  )

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