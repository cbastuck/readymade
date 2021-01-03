import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string';

import Runtime from './components/Runtime';
import BoardProvider, { BoardConsumer } from './BoardContext';
import DragProvider from './DragContext';
import BrowserRegistry from './runtime/BrowserRegistry';

function extractRuntimeData(data) {
  if (data.id && data.services) {
    return data;
  }

  const runtimesInData = Object.keys(data);
  const browserRuntimeIds = runtimesInData.filter(
    runtimeId => data[runtimeId].type === 'browser'
  );
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

export default class Sandbox extends Component {
  state = {
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

    const { 
      src, 
      data, 
      frameless='false',
    } = values;

    this.setState({ 
      options: {
        frameless: frameless === 'true' || frameless === true
      }
    });

    if (src) {
      this.fetchAndParseData(src);
    } else if (data) {
      const d = typeof data === 'string' ? JSON.parse(data) : data;
      this.parseData(d);
    }
  }

  configureService = (serviceId, config) => {
    if (this.runtime) {
      const service = this.runtime.app.getServiceById(serviceId);
      if (service) {
        service.configure(config);
      }
    }
  }

  fetchAndParseData = async src => {
    const response = await fetch(src);
    try {
      const data = await response.json();
      return this.parseData(data);
    } catch (err) {
      console.error('Fetched data is not valid JSON document', src, err);
    }
  }

  parseData = async data => {
    const firstBrowserRuntimeData = extractRuntimeData(data);
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
    this.setState({ 
      runtime: {
        id: firstBrowserRuntimeData.id,
        name: 'Sandbox',
        type: firstBrowserRuntimeData.type,
        bundles: firstBrowserRuntimeData.bundles
      },
      services: firstBrowserRuntimeData.services,
    });
    return firstBrowserRuntimeData;
  }

  createBrowserRuntime = async (backendData, bundles) => {
    /*
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
    */
  }

  fetchData = async () => {
    const { boardName='Sandbox' } = this.props;
    const { runtime, services } = this.state;
    return {
      board: { name: boardName },
      runtimes: [ runtime ], 
      services: {
        [runtime.id]: services,
      },
      registry: {
        [runtime.id]: await BrowserRegistry.create(runtime.bundles)
      }
    };
  }

  onResult = (serviceUuid, result) => {
    console.log('Sandbox result', serviceUuid, result);
  }

  renderSandbox = boardContext => {
    const { options, runtime } = this.state;
    return (
      <DragProvider key={`sandbox-drag-provider-${runtime.id}`}>
        <Runtime
          style={{ marginBottom: 5 }}
          ref={runtime => this.runtime=runtime}
          runtime={runtime}
          frameless={options && options.frameless}
          boardContext={boardContext}
          onResult={this.onResult}
        />
      </DragProvider>
    );
  }

  render() {
    const { 
      boardContext,
    } = this.props;

    const { runtime } = this.state;
    if (!runtime) {
      return false;
    }

    return boardContext ? 
      this.renderSandbox(boardContext) : 
      (
        <BoardProvider
          key={`sandbox-runtime-${runtime && runtime.id}`}
          fetchData={this.fetchData}
          getCurrentBrowserRuntime={_ => this.runtime}
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