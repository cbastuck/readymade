import React, { Component } from 'react';
import { Checkbox } from 'semantic-ui-react';
import uuid from 'uuid';

import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Runtime from '../components/Runtime';
import BrowserRuntime from '../runtime/BrowserRuntime'; 
import DragProvider from '../DragContext';
import { s, t } from '../styles';

function createRuntime(id, name, onResult, bundles=['hookup.to/registry/browser/Audio']) {
    return BrowserRuntime.createInstance({ 
      id, 
      name,
      sendResult: onResult,
    },
    { bundles }
  );
}

export default class Playground extends Component {
  state = {
    persistBoard: false,
    runtimes: [],
    services: {},
  };

  componentDidMount() {
    this.restoreBoard();
  }

  restoreBoard = async () => {
    const data = localStorage.getItem('hkp-playground');
    if (data) {
      const state = JSON.parse(data);
      const { runtimes, services } = state;
      const createdRuntimes = await this.restoreRuntimes(runtimes);
      await this.restoreServices(services, createdRuntimes);
    }
  }

  restoreRuntimes = async runtimes => {
    const created = [];
    for (const runtime of runtimes) {
      const rt = await this.addRuntime(runtime.id, runtime.name);
      created.push(rt);
    }
    return created;
  }

  restoreServices = async (services, runtimes) => {
    for (const runtime of runtimes) {
      for (const service of services[runtime.id]) {
        const { descriptor, config } = service;
        const svc = this.addService(descriptor, runtime);
        if (svc) {
          await svc.configure(config);
        }
      }
    }
  }

  storeBoard = () => {
    const { runtimes, services } = this.state;
    const data = JSON.stringify({ 
      runtimes: runtimes.map(rt => ({ id: rt.id, name: rt.name })), 
      services: Object.keys(services).reduce(
        (all, key) => ({
          ...all,
          [key]: services[key].map(svc => ({
            descriptor: svc.__descriptor,
            config: svc,
          }))
        }), 
        {}
      ),
    });
    localStorage.setItem('hkp-playground', data);
  }

  addService = (descriptor, runtimeOrId) => {
    const { runtimes, services } = this.state;
    const runtime = (typeof runtimeOrId === 'string') ? 
      runtimes.find(rt => rt.id === runtimeOrId) : 
      runtimeOrId;
    if (runtime) {
      const uid = uuid.v4();
      const svc = runtime.createService(descriptor, uid);
      const svcs = services[runtime.id];
      this.setState({ 
        services: { 
          ...services,
          [runtime.id]: [...svcs, svc],
        }
      });
      return svc;
    }
  }

  addRuntime = async (runtimeId, runtimeName) => {
    const { runtimes, services } = this.state;
    const rt = await createRuntime(
      runtimeId,
      runtimeName,
      this.onResult.bind(this, runtimeId),
    );
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: []
      }
    });
    return rt;
  }

  clearPlayground = () => {
    const { runtimes } = this.state;
    for (const runtime of runtimes) {
      runtime.destroyRuntime();
    }
    this.setState({ services: {}, runtimes: [] });
  }

  arrangeService = (runtime, serviceUuid, targetPosition) => {
    const { services: allServices } = this.state;
    const services = allServices[runtime.id]

    const service = services.find(svc => serviceUuid === svc.uuid);
    const rearranged = services.filter(svc => serviceUuid !== svc.uuid);
    rearranged.splice(targetPosition, 0, service);
    this.setState({
      services: {
        ...allServices,
        [runtime.id]: rearranged,
      }
    });
  }

  onAction = command => {
    const { type } = command;
    switch (type) {
      case 'clearBoard':
        return this.clearPlayground();
      default: 
      console.log('Playground.onAction not implemented', type);
    }
  }

  onResult = (runtimeId, svcUuid, result) => {
    const { runtimes } = this.state;
    const pos = runtimes.findIndex(rt => rt.id === runtimeId);
    if (pos !== -1) {
      const nextRuntime = runtimes[pos + 1];
      if (nextRuntime) {
        nextRuntime.processService(null, result);
      }
    }
  }

  renderRuntimes = boardContext => {
    const { runtimes, services } = this.state;
    return (
      <div style={s(t.w100)}>
        {
          runtimes.map(runtime => 
            <DragProvider
              style={{ marginBottom: 5 }}
              key={`playground-drag-provider-${runtime.id}`}
            >
              <Runtime
                key={`sandbox-playground-${runtime.id}`}
                runtime={runtime}
                boardContext={boardContext}
                services={services[runtime.id]}
              />
            </DragProvider>
          )
        }
      </div>
    );
  }

  render() {
    const boardName = 'Playground';
    const user = { 
      username: 'Anonymous',
      userId: undefined,
    };
    const availableRuntimes = [
      { name: 'browser', args: 'browser' },
    ];
    const { 
      persistBoard,
      runtimes,
    } = this.state;
    return (
      <BoardProvider
        user={user}
        boardName={boardName}
        fetchData={false}
        isRuntimeInScope={() => true}
        addService={this.addService}
        arrangeService={this.arrangeService} 
      >
        <BoardConsumer>
        {
          boardContext => (
            <div style={t.fill}>
              <Toolbar
                onAddRuntime={() => this.addRuntime(uuid.v4(), `Runtime-${runtimes.length + 1}`)}
                onAction={this.onAction}
                board={boardContext.boardName}
                availableRuntimes={availableRuntimes}
              />
              { this.renderRuntimes(boardContext) }
              <div style={s(t.w100, t.tr)}>
                <Checkbox 
                  style={s(t.uc, t.ls1, t.fs11, t.m(10, 20))}
                  slider
                  checked={persistBoard}
                  onChange={(_, { checked }) => 
                    this.setState(
                      { persistBoard: checked },
                      () => checked && this.storeBoard()
                    )
                  }
                  label="Store Board"
                />
              </div>
            </div>
          )
        }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}