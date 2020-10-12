import React, { Component } from 'react';
import { Message } from 'semantic-ui-react';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';
import Sandbox from '../Sandbox'; 

export default class ServiceReference extends Component {
  state = {
    state: 'initial',
    data: undefined,
  };
  
  componentDidMount() {
    const service = this.getService();
    this.fetchDocumentation(service);
  }

  renderNoDocumentationAvailable = service => {
    return (
      <div>
        <div style={{ marginLeft: 10 }}>
          Unfortunately no further documentation for <span style={{ fontWeight: 'bold' }}>{ service }</span> service exists at the the moment
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
      </div>
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

  renderFetchedDocs = (service, data) => {
    if (!data) {
      return false;
    }
    return (
      <div>
        <h1>{service} Reference</h1>
        {
          data.sections && data.sections.map((section, idx) => (
            <div key={`serice-reference-${service}-idx`}>
              <h1>{section.title}</h1>
            </div>
          ))
        }
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
          margin: 20,
          textAlign: 'center',
        }}
      >
        <Message style={{ width: '100%' }}>
          { 
            state === 'initial' ? false : (
              (state === 'fetching' && this.renderFetching(service))||
              (state === 'available' && this.renderFetchedDocs(service, data)) ||
              (state === 'missing' && this.renderNoDocumentationAvailable(service))
            )
          }
        </Message>
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
          data={`
            {
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
                    "serviceId": "hookup.to/service/${service}"
                  },
                  {
                    "serviceName": "Monitor",
                    "serviceId": "hookup.to/service/monitor-browser"
                  }
                ]
              }
            }
          `}
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
              <Footer />
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}