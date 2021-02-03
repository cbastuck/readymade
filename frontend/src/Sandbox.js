import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import uuid from 'uuid';
import queryString from 'query-string';

import Runtime from './components/Runtime';
import BoardProvider, { BoardConsumer } from './BoardContext';
import DragProvider from './DragContext';
import BrowserRegistry from './runtime/BrowserRegistry';

import { s, t } from './styles';

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

  configureService = (serviceUuid, config) => {
    if (this.runtime) {
      this.runtime.configureService(serviceUuid, config);
    }
  }

  fetchAndParseData = async src => {
    const response = await fetch(src);
    try {
      const data = await response.json();
      this.setState({ url: src });
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

  fetchData = async () => {
    const { boardName='Sandbox' } = this.props;
    const { runtime, services } = this.state;
    const registry = await BrowserRegistry.create(runtime.bundles);
    return {
      board: { name: boardName },
      runtimes: [ runtime ], 
      services: {
        [runtime.id]: services,
      },
      registry: {
        [runtime.id]: registry.availableServices,
      }
    };
  }

  onResult = (serviceUuid, result) => {
    // console.log('Sandbox result', serviceUuid, result);
  }

  renderSandbox(options, runtime, onResult) {
    const { url } = this.state;
    return (
      <BoardConsumer>
        { 
          boardContext => (            
            <DragProvider key={`sandbox-drag-provider-${runtime.id}`}>
              <Runtime
                key={`sandbox-runtime-${runtime.id}`}
                style={{ marginBottom: 5 }}
                ref={runtime => this.runtime=runtime}
                runtime={runtime}
                frameless={options && options.frameless}
                boardContext={boardContext}
                onResult={onResult}
                onArrangeService={null}
              />
              {
                url && (
                  <div
                    style={{
                      textAlign: 'right',
                      marginBottom: 2,
                    }}
                  >
                    <Link 
                      style={s(t.uc, t.ls1, t.fs12)}
                      to={`/playground?src=${url}`}
                    >
                      Open In Playground
                    </Link>
                  </div>
                )
              }
            </DragProvider>
          )
        }
      </BoardConsumer>
    );
  } 

  render() {
    const { runtime, options } = this.state;
    if (!runtime) {
      return false;
    }
    
    return (
      <BoardProvider fetchData={this.fetchData}>
      {
        this.renderSandbox(options, runtime, this.onResult) 
      }  
      </BoardProvider>
    );
  } 
}

