import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string';

import Runtime from './components/Runtime';
import { AppConsumer } from './AppContext';
import BoardProvider, { BoardConsumer } from './BoardContext';
import DragProvider from './DragContext';
import BrowserRuntime from './runtime/BrowserRuntime';

export default class Sandbox extends Component {
  state = {
    createdServices: [],
    runtime: undefined,
    options: {
      frameless: true,
    }
  };

  componentDidMount() {
    const { location } = this.props;
    const values = location ? 
      queryString.parse(location.search) :
      this.props;
    const { src, data, frameless='false' } = values;
    if (src) {
      this.fetchData(src);
      this.setState({ 
        options: {
          frameless: frameless === 'true'
        }
      });
    } else if (data) {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      this.processData(d);
    }
  }

  configureService = (serviceId, config) => {
    const { runtime } = this.state;
    if (runtime) {
      const service = runtime.app.getServiceById(serviceId);
      if (service) {
        service.configure(config);
      }
    }
  }

  fetchData = async src => {
    const response = await fetch(src);
    const data = await response.json();
    return this.processData(data);
  }

  processData = async data => {
    const runtimesInData = Object.keys(data);
    const browserRuntimeIds = runtimesInData.filter(runtimeId => data[runtimeId].type === 'browser');
    const firstBrowserRuntimeId = browserRuntimeIds[0];
    if (firstBrowserRuntimeId) {
      const firstBrowserRuntimeData = data[firstBrowserRuntimeId];
      if (firstBrowserRuntimeData && firstBrowserRuntimeData.services) {
        // add an uuid to each service if this is not present
        firstBrowserRuntimeData.services.map(s => {
          if (!s.uuid) {
            s.uuid = uuid.v4();
          }
          return s;
        })

        firstBrowserRuntimeData.id = firstBrowserRuntimeId;
      }
      const { runtime, createdServices } = await this.createBrowserRuntime(firstBrowserRuntimeData, firstBrowserRuntimeData.bundles);
      if (runtime) {
        this.setState({ runtime, createdServices });
      }
      return firstBrowserRuntimeData;
    }
  }

  createBrowserRuntime = async (backendData, bundles) => {
    const runtime = await BrowserRuntime.createInstance({ 
        id: `${backendData.id}-public`, 
        name: `${backendData.name}-public`,
        sendResult: (uuid, result) => { /*console.log('SENDING RESULT', result)*/ }
      },
      { bundles }
    );
    const createdServices = backendData.services.map(s => {
      const svc = runtime.createService(s, s.uuid || s.serviceUuid);
      svc && svc.configure && svc.configure(s);
      return svc;
    });
    return { runtime, createdServices };
  }

  render() {
    const { runtime } = this.state;
    return (
      <AppConsumer>
      {
        appContext => 
          <BoardProvider 
            boardName="Sandbox"
            fetchData={false}
            getCurrentBrowserRuntime={_ => this.state.runtime}
          >
            <BoardConsumer>
              {
                boardContext => {
                  return (
                    <DragProvider>
                      <Runtime
                        key="sandbox-scene"
                        runtimeName="Sandbox"
                        style={{ marginBottom: 5 }}
                        frameless={this.state.options && this.state.options.frameless}
                        services={this.state.createdServices}
                        runtimeId={runtime && runtime.id}
                        boardContext={{
                          isRuntimeInScope: () => false,
                          boardName: boardContext.boardName,
                          appViewMode: boardContext.appViewMode,
                          user: {
                            userId: undefined,
                          }
                        }}
                      />
                    </DragProvider>
                  )
                }
              }
            </BoardConsumer>
          </BoardProvider>
      }
      </AppConsumer>
    )
  }
}