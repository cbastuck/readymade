import React, { Component } from 'react';
import { Checkbox } from 'semantic-ui-react';
import uuid from 'uuid';

import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Runtime from '../components/Runtime';
import DragProvider from '../DragContext';
import { s, t } from '../styles';
import BrowserRegistry from '../runtime/BrowserRegistry';
import { filterPrivateMembers } from '../runtime/services/helpers';

const defaultBundles = [
  'hookup.to/registry/browser/Audio'
];

export default class Playground extends Component {
  state = {
    persistBoard: false,
  };

  board = {
    name: 'Playground',
  };

  user = { 
    username: 'Anonymous',
    userId: undefined,
  };
  
  availableRuntimes = [
    { name: 'browser', args: 'browser' },
  ];

  runtimeInstances = {};

  restoreBoard = () => {
    const data = localStorage.getItem('hkp-playground');
    return data ? JSON.parse(data) : {};
  }

  storeBoard = () => {
    const { runtimes=[], services={} } = this.state;

    const data = { 
      runtimes: runtimes.map(rt => ({ 
        id: rt.id, name: rt.name, type: rt.type 
      })), 
      services: Object.keys(services).reduce(
        (all, runtimeId) => {
          const rt = this.getRuntimeById(runtimeId);
          return {
            ...all,
            [runtimeId]: services[runtimeId].map(
              s => ({
                ...filterPrivateMembers(
                  rt.getServiceById(s.uuid)
                ),
                serviceId: s.serviceId,
                serviceName: s.serviceName,
              })
            ),
          };
        }, 
        {}
      ),
    };
    localStorage.setItem('hkp-playground', JSON.stringify(data));
  }

  getRuntimeById = runtimeId => {
    const { runtimes=[] } = this.state;
    const runtime = runtimes.find(rt => rt.id === runtimeId);
    if (!runtime) {
      console.error('Unknown runtime', runtimeId);
      return;
    }
    return this.runtimeInstances[runtime.id];
  }

  addService = (boardName, descriptor, runtimeId) => {
    const { services={} } = this.state;
    const runtime = this.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }
    const svc = {
      ...descriptor,
      uuid: uuid.v4(),
    };
    this.setState({
      services: {
        ...services,
        [runtimeId]: [
          ...services[runtimeId], 
          svc,
        ],
      }
    });
    return svc;
  }

  removeService = async (boardName, runtimeId, service) => {
    const { services={} } = this.state;
    const runtime = this.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }

    await runtime.destroyService(service.uuid);
    
    const runtimeServices = services[runtimeId];
    const updatedServices = runtimeServices.filter(svc => svc.uuid !== service.uuid);
    this.setState({
      services: {
        ...services,
        [runtimeId]: updatedServices,
      }
    });
  }

  addRuntime = async (boardname, desc) => {
    const { runtimes=[], services={} } = this.state;
    const runtimeId = uuid.v4();
    const rt = {
      id: runtimeId,
      name: `Runtime-${runtimes ? runtimes.length + 1 : 1}`,
      type: 'browser'
    };
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: []
      }
    });
  }

  removeRuntime = async runtime => {
    const rt = this.getRuntimeById(runtime.id);
    if (!rt) {
      return;
    }

    await rt.destroyRuntime();

    const { runtimes=[], services={} } = this.state;
    const updatedRuntimes = runtimes.filter(r => r.id !== runtime.id);
    const updatedServices = Object.keys(services)
        .filter(r => r.id !== runtime.id)
        .reduce((all, key) => ({ ...all, [key]: services[key] }), {});
    this.setState({
      runtimes: updatedRuntimes,
      services: updatedServices,
    });
  }

  clearPlayground = () => {
    const { runtimes } = this.state;
    for (const runtime of runtimes) {
      const rt = this.runtimeInstances[runtime.id];
      rt.destroyRuntime();
    }
    this.setState({ services: {}, runtimes: [] });
  }

  arrangeService = (runtime, serviceUuid, targetPosition) => {
    const { services: allServices } = this.state;
    const services = allServices[runtime.id];

    const service = services.find(svc => serviceUuid === svc.uuid);
    const oldPosition = services.indexOf(service);
    const rearranged = services.filter(svc => serviceUuid !== svc.uuid);
    const offset = targetPosition < oldPosition ? 0 : 1; 
    rearranged.splice(targetPosition - offset, 0, service);
    this.setState({
      services: {
        ...allServices,
        [runtime.id]: rearranged,
      }
    });
  }

  getNextRuntime = runtime => {
    const { runtimes } = this.state;
    const pos = runtimes.findIndex(rt => rt.id === runtime.id);
    const nextRuntime = (pos !== -1) && runtimes[pos + 1];
    return nextRuntime && this.runtimeInstances[nextRuntime.id];
  }

  onResult = (runtime, svcUuid, result) => {
    const nextRuntime = this.getNextRuntime(runtime);
    if (nextRuntime) {
      nextRuntime.processRuntime(result);
    }
  }
  

  fetchData = async () => {
    let runtimes = this.state.runtimes;
    let services = this.state.services;
    if (!runtimes) {
      const { 
        runtimes: restoredRuntimes, 
        services: restoredServices,
      } = this.restoreBoard();

      runtimes = restoredRuntimes || [];
      services = restoredServices || {};
      this.setState({ 
        runtimes, 
        services,
      });
    }
    
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles); 
    }

    const data = {
      board: { name: 'Playground' },
      runtimes, 
      services,
      registry: runtimes && runtimes.reduce(
        (all, rt) => ({ ...all, [rt.id]: this.defaultRegistry.availableServices }), 
        {}
      ),
    };
    return data;
  }

  renderRuntimes = boardContext => {
    const { runtimes } = boardContext;
    return (
      <div style={s(t.w100)}>
      {
        runtimes.map(runtime => 
          <DragProvider
            key={`playground-drag-provider-${runtime.id}`}
            style={{ marginBottom: 5 }}
          >
            <Runtime
              key={`sandbox-playground-${runtime.id}`}
              ref={rt => this.runtimeInstances[runtime.id] = rt}
              boardContext={boardContext}
              runtime={runtime}
              onResult={this.onResult.bind(this, runtime)}
            />
          </DragProvider>
        )
      }
      </div>
    );
  }

  render() {
    const { persistBoard } = this.state;
    return (
      <BoardProvider
        user={this.user}
        boardName={this.board.name}
        fetchData={this.fetchData}
        isRuntimeInScope={() => true}
        addRuntime={this.addRuntime}
        removeRuntime={this.removeRuntime}
        addService={this.addService}
        removeService={this.removeService}
        clearBoard={this.clearPlayground}
        arrangeService={this.arrangeService}
      >
        <BoardConsumer>
        {
          boardContext => (
            <div style={t.fill}>
              <Toolbar
                board={boardContext.boardName}
                availableRuntimes={this.availableRuntimes}
              />
              { this.renderRuntimes(boardContext) }
              <div style={s(t.w100, t.tr)}>
                <Checkbox 
                  style={s(t.uc, t.ls1, t.fs11, t.m(10, 20))}
                  toggle
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