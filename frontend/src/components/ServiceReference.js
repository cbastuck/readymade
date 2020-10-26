import React, { Component } from 'react';
import { 
  Message, 
  Button,
} from 'semantic-ui-react';

import Sandbox from '../Sandbox'; 
import ReferenceTemplate from './ReferenceTemplate';

import { s, t } from '../styles';

function getSandboxData(service, name) {
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
          "serviceName": "${name || service}",
          "serviceId": "hookup.to/service/${service}",
          "uuid": "reference-service-id"
        },
        {
          "serviceName": "Monitor",
          "serviceId": "hookup.to/service/monitor"
        }
      ]
    }
  }`;
}

export default class ServiceReference extends Component {
  tryConfiguration = (service, config) => {
    if (this.sandbox) {
      this.sandbox.configureService('reference-service-id', config);
    }   
  }

  renderHeadline = text => {
    return (
      <h1 
        style={s(t.fs13, t.ls1, 
          { fontWeight: 'lighter', textAlign: 'left', color: '#4284C4' }
        )}
      >
        {text}
      </h1>
    );
  }

  renderTodoItem = (service, item) => {
    return (
      <div>
        <h1 style={s(t.ul, t.fs12)}>{item.brief}</h1>
        <div> {item.description} </div>
        <div style={t.right}>
          <Button style={s(t.uc, t.ls1, t.fs11)}> Show Task </Button>
        </div>
      </div>
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
            style={s(t.fs12, t.uc, t.ls1, t.w100, t.mt5, t.borderCol('#4284C499'))}
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
      case 'todo': 
        return this.renderTodoItem(service, item)
      default: 
        return (
          <div>Unknown Item {item.type}</div>
        );
    }
  }

  renderParagraph = (service, textOrObject) => {
    return (
      <div style={s(t.tl, t.m(0, 5))}>
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
      <div style={t.fill}>
        <Message style={{ width: '100%', marginBottom: 0 }}>
          <h1 style={t.fs13}>
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
          { this.renderHeadline("open issues") }
          { this.renderParagraphs(service, data.todos) }
        </div>
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

  renderServiceSandbox = (service, name) => {
    return (
      <Sandbox
        ref={sandbox => this.sandbox = sandbox}
        data={getSandboxData(service, name)}
      />
    );
  }

  render() {
    const { service, name=service } = this.props;
    if (!service) {
      return false;
    }

    const headlineStyle = s(t.m(10, 0), t.fs14, t.uc, t.ls1);
    return (
      <div style={s(t.fill, t.fs12)}>
      <h1 style={headlineStyle}>About this documentation</h1>
      <div style={s(t.m10, t.uc, t.ls1, { marginBottom: 20 })}>
        <div>
          The following sandbox allows you to try the <span style={{color: '#4284C4' }}>{name}</span> service in different configurations and inject input data. The
        </div>
        <div>
          The monitor service at the output shows how the injected data is processed.
        </div>
      </div>
      <h1 style={headlineStyle}>{name}-service in Action</h1>
      { this.renderServiceSandbox(service, name) }
      <h1 style={headlineStyle}>Detailed description</h1>
      <ReferenceTemplate 
        name={name}
        url={`/serviceDocs/${service}.json`}
        renderFetched={data => this.renderFetchedDocs(service, data)}
      />
      </div>
    );
  }
}