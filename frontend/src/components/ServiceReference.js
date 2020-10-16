import React, { Component } from 'react';
import { 
  Message, 
  Button,
  Dimmer,
  Loader,
  Segment,
} from 'semantic-ui-react';

import Sandbox from '../Sandbox'; 

function getSandboxData(service) {
  return `{
    "b73af90e-537b-46ba-b7aa-3870cfd2d958": {
      "id": "b73af90e-537b-46ba-b7aa-3870cfd2d958",
      "name": "Chrome-78.0.3904.108 (0)",
      "type": "browser",
      "services": [
        {
          "serviceName": "Injector",
          "serviceId": "hookup.to/service/injector"
        },
        {
          "serviceName": "${service}",
          "serviceId": "hookup.to/service/${service}",
          "uuid": "reference-service-id"
        },
        {
          "serviceName": "Monitor",
          "serviceId": "hookup.to/service/monitor-browser"
        }
      ]
    }
  }`;
}

export default class ServiceReference extends Component {
  state = {
    state: 'initial',
    data: undefined,
  };
  
  componentDidMount() {
    const { service } = this.props;
    if (service) {
      this.fetchDocumentation(service);
    }
  }

  tryConfiguration = (service, config) => {
    if (this.sandbox) {
      this.sandbox.configureService('reference-service-id', config);
    }   
  }

  renderNoDocumentationAvailable = service => {
    return (
      <Message style={{ width: '100%' }} error>
        <div style={{ marginLeft: 10, fontSize: 13 }}>
          Unfortunately no further documentation for <span style={{ fontWeight: 'bold' }}>{ service }</span> exists at the the moment
        </div>
        <div style={{ marginTop: 30 }}>
          <span 
            role="img" 
            aria-label="grimacing-emoji"
            style={{ fontSize: 45 }}
          > 
            😬 
          </span>
        </div>
      </Message>
    );
  }

  renderFetching = service => {
    return (
      <Dimmer.Dimmable dimmed={true}>
        <div 
          style={{ 
            paddingLeft: 10, 
            marginBottom: 20, 
            height: 200,
            border: 'solid 1px gray',
            borderRadius: 5,
          }}
        >
          <Dimmer active inverted>
            <Loader
              style={{ 
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontSize: 12
              }}
              content='Retrieving Description'
              inverted
            />
          </Dimmer>
        </div>
      </Dimmer.Dimmable>
    );
  }

  renderHeadline = text => {
    return (
      <h1 
        style={{ 
          fontSize: 13,
          letterSpacing: 1,
          fontWeight: 'lighter',
          textAlign: 'left',
          color: '#4284C4'
        }}
      >
        {text}
      </h1>
    );
  }

  renderConfigItem = (service, item) => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          border: 'solid 1px lightgray',
          borderRadius: 5,
          padding: 10,
        }}
      >
        <div 
          style={{ 
            marginTop: 10, 
            marginRight: 10,
            width: '60%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <h1 style={{ fontSize: 13 }}>Example</h1>
          <div>
            { item.description }
          </div>
        </div>
        <div 
          style={{ 
            width: '40%',
            marginLeft: 'auto'
          }}
        >
          <div 
            style={{
              padding: 5,
              backgroundColor: '#4284C433',
              border: 'solid 1px #4284C4',
              borderRadius: 5,
            }}
          >
            <div>
              <pre 
                style={{ 
                  textTransform: 'none', 
                  color: '#333',
                  overflowX: 'auto'
                }}
              >
                { JSON.stringify(item.value, null, 2) }
              </pre>
            </div>
          </div>
          <Button 
            style={{ 
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
              width: '100%',
              marginTop: 5,
              border: 'solid 1px #4284C499',
            }}
            onClick={() => this.tryConfiguration(service, item.value)}
          >
            Try
          </Button>
        </div>
      </div>
    );
  }

  renderItem = (service, item) => {
    switch (item.type) {
      case 'config':
        return this.renderConfigItem(service, item);
      default: 
        return (
          <div>Unknown Item {item.type}</div>
        );
    }
  }

  renderParagraph = (service, textOrObject) => {
    return (
      <div
        style={{
          textAlign: 'left',
          margin: "5px 0px"
        }}  
      >
        { 
          typeof textOrObject === 'string' ? 
            textOrObject : 
            this.renderItem(service, textOrObject) 
        }
      </div>
    );
  }

  renderParagraphs = (service, paragraphs) => {
    return paragraphs && paragraphs.map((section, idx) => (
        <div key={`service-reference-desc-${service}-${idx}`}>
        { this.renderParagraph(service, section) }
        </div>
      ))
  }

  renderFetchedDocs = (service, data) => {
    return data && (
      <div style={{ width: '100%', height: '100%' }}>
        <Message style={{ width: '100%', marginBottom: 0 }}>
          <h1 style={{ fontSize: 13 }}>
            <span style={{ color: '#4284C4', fontWeight: 'bold' }}> {service} </span> 
            <span style={{ color: 'black', fontWeight: 'lighter' }}> Service </span>
          </h1>
        </Message>
        <div 
          style={{
            border: 'solid 1px lightgray',
            borderTop: 'none',
            borderRadius: 5,
            padding: 10,
            marginTop: 0,
          }}
        >
          { this.renderHeadline('brief') }
          { this.renderParagraph(service, data.brief) }
          { this.renderHeadline('configuration') }
          { this.renderParagraphs(service, data.configuration) }
          { this.renderHeadline("input") }
          { this.renderParagraphs(service, data.inputs) }
          { this.renderHeadline("output") }
          { this.renderParagraphs(service, data.outputs) }
        </div>
      </div>
    );
  }

  renderDocumentation = service => {
    const { state, data } = this.state;
    return (
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: 12,
          margin: '0px 10px',
          textAlign: 'center',
          height: '100%'
        }}
      >
          { 
            state === 'initial' ? false : (
              (state === 'fetching' && this.renderFetching(service))||
              (state === 'available' && this.renderFetchedDocs(service, data)) ||
              (state === 'missing' && this.renderNoDocumentationAvailable(service))
            )
          }
      </div>
    );
  }

  fetchDocumentation = async service => {
    this.setState({ state: 'fetching' });
    const url = `/serviceDocs/${service}.json`;
    try {
      const doc = await fetch(url);
      this.setState({ 
        data: await doc.json(),
        state: 'available'
      });
    } catch(err) {
      this.setState({ state: 'missing' });
    } 
  }

  renderServiceSandbox = service => {
    return (
      <Sandbox
        ref={sandbox => this.sandbox = sandbox}
        data={getSandboxData(service)}
      />
    );
  }

  render() {
    const { service } = this.props;
    if (!service) {
      return false;
    }

    const headlineStyle = {
      margin: 10,
      fontSize: 14,
    };
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '100%',
          textTransform: 'uppercase', 
          letterSpacing: 1, 
          fontSize: 12,
        }}
      >
      <h1 style={headlineStyle}>About this documentation</h1>
      <div style={{ margin: 10, marginBottom: 20 }}>
        <div>
          The following sandbox allows you to try the <span style={{color: '#4284C4' }}>{service}</span> service in different configurations and inject input data. The
        </div>
        <div>
          The monitor service at the output shows how the injected data is processed.
        </div>
      </div>
      <h1 style={headlineStyle}>Sandbox</h1>
      { this.renderServiceSandbox(service) }
      <h1 style={headlineStyle}>Detailed description</h1>
      { this.renderDocumentation(service) }
      </div>
    );
  }
}