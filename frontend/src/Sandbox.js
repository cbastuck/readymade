import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string';

import Runtime from './components/Runtime';
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
    const { location, runtime } = this.props;
    if (runtime) {
      this.setState({ 
        runtime, 
        createdServices: runtime.services,
        frameless: false,
      })
    } else {
      const values = location ? 
        queryString.parse(location.search) :
        this.props;

      const { 
        src, 
        data, 
        frameless='false',
      } = values;

      if (src) {
        this.fetchDataAndCreateRuntime(src);
      } else if (data) {
        const d = typeof data === 'string' ? JSON.parse(data) : data;
        this.readDataAndCreateRuntime(d);
      }
      this.setState({ 
        options: {
          frameless: frameless === 'true' || frameless === true
        }
      });
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

  fetchDataAndCreateRuntime = async src => {
    const response = await fetch(src);
    try {
      const data = await response.json();
      return this.readDataAndCreateRuntime(data);
    } catch (err) {
      console.error('Fetched data is not valid JSON document', src, err);
    }
  }

  extractRuntimeData = data => {
    if (data.id && data.services) {
      return data;
    }

    const runtimesInData = Object.keys(data);
    const browserRuntimeIds = runtimesInData.filter(runtimeId => data[runtimeId].type === 'browser');
    const firstBrowserRuntimeId = browserRuntimeIds[0];
    if (!firstBrowserRuntimeId) {
      return;
    }

    const firstBrowserRuntimeData = data[firstBrowserRuntimeId];
    if (!firstBrowserRuntimeData || !firstBrowserRuntimeData.services) {
      return;
    }

    firstBrowserRuntimeData.id = firstBrowserRuntimeId;
    return firstBrowserRuntimeData;
  }

  readDataAndCreateRuntime = async data => {
    const firstBrowserRuntimeData = this.extractRuntimeData(data);
    if (!firstBrowserRuntimeData) {
      return;
    }

    // add an uuid to each service if this is not present
    firstBrowserRuntimeData.services.map(s => {
      if (!s.uuid) {
        s.uuid = uuid.v4();
      }
      return s;
    });
      
    const { runtime, createdServices } = await this.createBrowserRuntime(firstBrowserRuntimeData, firstBrowserRuntimeData.bundles);
    if (runtime) {
      this.setState({ runtime, createdServices });
    }
    return firstBrowserRuntimeData;
  }

  createBrowserRuntime = async (backendData, bundles) => {
    const { onResult = (uuid, result) => {} } = this.props;
    const runtime = await BrowserRuntime.createInstance({ 
        id: `${backendData.id}-public`, 
        name: `${backendData.name}-public`,
        sendResult: onResult,
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

  renderSandbox = boardContext => {
    const {
      runtime,
      options,
      createdServices,
    } = this.state;

    const runtimeId = runtime ? runtime.id : 'anonymousRuntime';
    return (
      <DragProvider key={`sandbox-drag-provider-${runtimeId}`}>
        <Runtime
          runtimeName="Sandbox"
          style={{ marginBottom: 5 }}
          frameless={options && options.frameless}
          services={createdServices}
          runtimeId={runtimeId}
          boardContext={boardContext}
        />
      </DragProvider>
    );
  }

  render() {
    const { 
      boardContext,
      boardName='Sandbox',
    } = this.props;

    const { runtime } = this.state;

    return boardContext ? 
      this.renderSandbox(boardContext) : 
      (
        <BoardProvider
          key={runtime && runtime.id}
          boardName={boardName}
          fetchData={false}
          getCurrentBrowserRuntime={_ => runtime}
        >
          <BoardConsumer>
            { 
              boardContext => 
                this.renderSandbox({
                  ...boardContext, 
                  isRuntimeInScope: () => false 
                })
            }
          </BoardConsumer>
        </BoardProvider>
      )
  }
}