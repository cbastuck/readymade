import React, { Component } from 'react';
import { 
  Message, 
  Button,
} from 'semantic-ui-react';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';
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
    const service = this.getService();
    this.fetchDocumentation(service);
  }

  tryConfiguration = (service, config) => {
    if (this.sandbox) {
      this.sandbox.configureService('reference-service-id', config);
    }   
  }

  renderNoDocumentationAvailable = service => {
    return (
      <Message style={{ width: '100%' }} error>
        <div style={{ marginLeft: 10, fontSize: 14 }}>
          Unfortunately no further documentation for <span style={{ fontWeight: 'bold' }}>{ service }</span> exists at the the moment
        </div>
        <div style={{ marginTop: 30 }}>
          <span 
            role="img" 
            aria-label="grimacing-emoji"
            style={{ fontSize: 50 }}
          > 
            😬 
          </span>
        </div>
      </Message>
    );
  }

  renderFetching = service => {
    return (
      <div>
        <div style={{ marginLeft: 10, marginBottom: 20 }}>
          Searching for <span style={{ fontWeight: 'bold' }}>{ service }</span> documentation ...
        </div>
        <span 
            role="img" 
            aria-label="searching-emoji"
            style={{ fontSize: 50 }}
          > 
            🔍 
          </span>
      </div>
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
      <div>
        <div>
          Example: { item.description }
        </div>
        <Message 
          color='green'
          style={{ 
            width: '50%',
          }}
        >
          <div
            style={{ 
              display: 'flex',
              flexDirection: 'row',
              marginLeft: 20,
            }} 
          >
            <pre>
              { JSON.stringify(item.value, null, 2) }
            </pre>
              <div style={{ marginLeft: 'auto', marginTop: 30 }}>
              <Button 
                style={{ 
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  backgroundColor: 'white',
                  border: 'solid gray 1px',
                  borderRadius: 5,
                  color: '#4284C4'
                }}
                onClick={() => this.tryConfiguration(service, item.value)}
              >
                Try
              </Button>
            </div>
          </div>
        </Message>      
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
      <div>
        <Message style={{ width: '100%', marginBottom: 0 }}>
          <h1 style={{ fontSize: 13 }}>
            <span style={{ color: '#4284C4', fontWeight: 'bold' }}> {service} </span> 
            <span style={{ color: 'black', fontWeight: 'lighter' }}> Reference </span>
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
          margin: '0px 20px',
          textAlign: 'center',
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
      <div>
        <Sandbox
          ref={sandbox => this.sandbox = sandbox}
          data={getSandboxData(service)}
        />
      </div>
    );
  }

  getService = () => {
    const { match } = this.props;
    const { params } = match || {};
    const { service } = params || {};
    return service;
  }

  render() {
    const service = this.getService();
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.user && !!appContext.user.username}
            >
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <BoardConsumer>
                {
                  boardContext => (
                    <div style={{ height: '100%' }}>
                      <Toolbar 
                        savedBoards={boardContext.savedBoards}
                        onAction={boardContext.onAction}
                      />
                      { this.renderServiceSandbox(service) }
                      { this.renderDocumentation(service) }
                    </div>
                  )
                }
                </BoardConsumer>
                <Footer flex />
              </div>
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}