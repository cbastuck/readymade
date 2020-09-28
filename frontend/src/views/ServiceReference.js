import React, { Component } from 'react';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';
import Sandbox from '../Sandbox'; 

export default class ServiceReference extends Component {
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
                    "serviceName": "Input",
                    "serviceId": "hookup.to/service/trigger"
                  },
                  {
                    "serviceName": "${service}",
                    "serviceId": "hookup.to/service/${service}",
                    "enableMidiInput": "Akai APC40"
                  },
                  {
                    "serviceName": "Output",
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

  render() {
    const { match } = this.props;
    const { params } = match || {};
    const { service } = params || {};
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