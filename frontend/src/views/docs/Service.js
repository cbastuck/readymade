import React, { Component } from 'react';

import Template from './Template'

import { ExampleService, ExampleServiceUI } from './ExampleService';
import ServiceFrame from '../../components/ServiceFrame';

export default class ServiceDocumentation extends Component {
  renderExampleService = () => {
    const service = new ExampleService();
    const serviceUI = (
      <ExampleServiceUI
        service={service}
        setup={() => service} 
      />
    );
    return (
      <div 
        style={{ 
          marginTop: 20,
          marginRight: 30, 
          width: 300
        }}
      >
        <ServiceFrame service={serviceUI} />
      </div>
    );
  }

  render() {
    return (
      <Template 
        title="Service"
      >
        <div style={{ height: '100%' }}>
          { this.renderExampleService() }
        </div>
      </Template>
    );
  }
}