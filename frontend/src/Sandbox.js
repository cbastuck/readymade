import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string';

import Scene from './components/Scene';
import { AppConsumer } from './AppContext';
import BoardProvider, { BoardConsumer } from './BoardContext';
import { createServiceUI } from './UIFactory';
import BrowserRuntime from './runtime/BrowserRuntime';

export default class Sandbox extends Component {
  state = {
    backendData: undefined,
    runtime: undefined,
    options: {
      frameless: true,
    }
  };

  componentDidMount() {
    const { location } = this.props;
    const values = queryString.parse(location.search);
    const { src, frameless='false' } = values;
    if (src) {
      this.fetchData(src);
      this.setState({ 
        options: {
          frameless: frameless === 'true'
        }
      });
    }
  }

  async fetchData(src) {
    const response = await fetch(src);
    const data = await response.json();
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
      const runtime = await this.createBrowserRuntime(firstBrowserRuntimeData, firstBrowserRuntimeData.bundles);
      if (runtime) {
        this.setState({ runtime, backendData: firstBrowserRuntimeData });
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
    backendData.services.map(s => {
      const svc = runtime.createService(s, s.uuid || s.serviceUuid);
      svc && svc.configure && svc.configure(s);
      return svc;
    });
    return runtime;
  }

  render() {
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
                    <Scene
                      key="sandbox-scene"
                      runtimeName="Sandbox"
                      style={{ marginBottom: 5 }}
                      frameless={this.state.options && this.state.options.frameless}
                    >
                      {
                        this.state.backendData && 
                        this.state.backendData.services.map(svc => 
                          createServiceUI(
                            boardContext.boardName, 
                            svc, 
                            this.state.runtime.id
                          )
                        )
                      }
                    </Scene>
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