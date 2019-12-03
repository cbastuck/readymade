import React, { Component } from 'react';

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
  };

  componentDidMount() {
    const { location } = this.props;
    const values = queryString.parse(location.search);
    const { src } = values;
    if (src) {
      this.fetchData(src);
    }
  }

  async fetchData(src) {
    const response = await fetch(src);
    const data = await response.json();
    const runtimesInData = Object.keys(data);
    const firstRuntimeId = runtimesInData && runtimesInData[0];
    if (firstRuntimeId) {
      const firstRuntimeData = data[firstRuntimeId];
      this.createBrowserRuntime(firstRuntimeData);
      return firstRuntimeData;
    }
  }

  createBrowserRuntime = backendData => {
    const runtime = new BrowserRuntime({ 
      id: `${backendData.id}-public`, 
      name: `${backendData.name}-public`,
      sendResult: (uuid, result) => console.log('SENDING RESULT', result)
    });
    backendData.services.map(s => runtime.createService(s, s.uuid));
    this.setState({ runtime, backendData });
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