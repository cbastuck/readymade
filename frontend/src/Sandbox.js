import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string'

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
    const firstRuntimeId = runtimesInData && runtimesInData[0];
    if (firstRuntimeId) {
      const firstRuntimeData = data[firstRuntimeId];
      if (firstRuntimeData && firstRuntimeData.services) {
        // add an uuid to each service if this is not present
        firstRuntimeData.services.map(s => {
          if (!s.uuid) {
            s.uuid = uuid.v4();
          }
          return s;
        })
      }
      const runtime = this.createBrowserRuntime(firstRuntimeData);
      this.setState({ runtime, backendData: firstRuntimeData });
      return firstRuntimeData;
    }
  }

  createBrowserRuntime = backendData => {
    const runtime = new BrowserRuntime({ 
      id: `${backendData.id}-public`, 
      name: `${backendData.name}-public`,
      sendResult: (uuid, result) => console.log('SENDING RESULT', result)
    });
    backendData.services.map(s => {
      const svc = runtime.createService(s, s.uuid);
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
                      runtime="Sandbox"
                      readonly={false}
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