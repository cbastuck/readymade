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
        <div 
          style={{ 
            height: '100%',
            display: 'flex',
            flexDirecton: 'row',
          }}
        >
          <div 
            style={{ 
              margin: '30px 5px',
              width: '80%',
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontSize: 12,
            }}
          > 
            Services consist of two components, one is the main and invisible component of the service implementing the logic.
            The other component is the user interface (UI) which allows to configure and interact with the service.
          </div>
          { this.renderExampleService() }
        </div>
      </Template>
    );
  }
}