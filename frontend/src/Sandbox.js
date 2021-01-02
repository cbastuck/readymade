import React, { Component } from 'react';

import uuid from 'uuid';
import queryString from 'query-string';

import Runtime from './components/Runtime';
import BoardProvider, { BoardConsumer } from './BoardContext';
import DragProvider from './DragContext';
import BrowserRuntime from './runtime/BrowserRuntime';

function extractRuntimeData(data) {
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

export default class Sandbox extends Component {
  state = {
    data: '',
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
    const { runtime } = this.state; // TODO: use ref to configure browser service inside the runtime
    if (runtime) {
      const service = runtime.app.getServiceById(serviceId);
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
      
    this.setState({ data: firstBrowserRuntimeData});
    
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
      data,
    } = this.state;

    const runtimeId = runtime ? runtime.id : 'anonymousRuntime';
    return (
      <DragProvider key={`sandbox-drag-provider-${runtimeId}`}>
        <Runtime
          style={{ marginBottom: 5 }}
          runtime={{
            runtimeName: 'Sandbox',
            runtimeId,
          }}
          frameless={options && options.frameless}
          services={createdServices}
          boardContext={boardContext}
          bundles={data.bundles}
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