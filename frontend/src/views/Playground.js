import React, { Component } from 'react';
import { Icon, Checkbox } from 'semantic-ui-react';
import uuid from 'uuid';

import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Runtime from '../components/Runtime';
import SidechainSelector from '../components/SidechainSelector';
import DragProvider from '../DragContext';
import { s, t } from '../styles';
import BrowserRegistry from '../runtime/BrowserRegistry';
import { filterPrivateMembers } from '../runtime/services/helpers';

const defaultBundles = [
  'hookup.to/registry/browser/Audio'
];

const serviceWhitelist = [
  'hookup.to/service/timer',
  'hookup.to/service/monitor',
  'hookup.to/service/canvas',
  'hookup.to/service/map',
  'hookup.to/service/camera',
  'hookup.to/service/injector',
  'hookup.to/service/trigger-pad',
  'hookup.to/service/sound',
  'hookup.to/service/mp3encoder',
  'hookup.to/service/audio-output',
  'hookup.to/service/microphone',
  'hookup.to/service/input',
];

export default class Playground extends Component {
  state = {
    persistBoard: false,
    showSidechainSelector: false,
    sidechainRouting: {},
    placeholderAnimationRunning: false,
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

  importBoard = async url => {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const runtimeIds = Object.keys(data);
      return {
        runtimes: runtimeIds.map((rid, ridx) => ({
          id: rid,
          type: data[rid].type,
          name: data[rid].name || `Runtime ${ridx + 1}`,
        })),
        services: runtimeIds.reduce(
          (all, rid) => ({
            ...all,
            [rid]: data[rid].services.map(svc => {
              if (!svc.uuid) {
                return { ...svc, uuid: uuid.v4() };
              }
              return svc;
            })
          }), 
          {}
        )
      };
    } catch (err) {
      console.log('Import failed', err, url)
    }
  }

  restoreBoard = () => {
    const data = localStorage.getItem('hkp-playground');
    return data ? JSON.parse(data) : {};
  }

  storeBoard = () => {
    const { 
      runtimes=[], 
      services={}, 
      sidechainRouting={} 
    } = this.state;

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
      sidechainRouting,
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

  onResult = async (runtime, svcUuid, result) => {
    const { sidechainRouting } = this.state;
    const routing = sidechainRouting && sidechainRouting[runtime.id];
    if (routing) {
      for (const route of routing) {
        const dst = this.runtimeInstances[route.runtimeId];
        await dst.configureService(route.serviceUuid, result);
      }
      return; // runtimes with routing aren't further processed
    }
    const nextRuntime = this.getNextRuntime(runtime);
    if (nextRuntime) {
      nextRuntime.processRuntime(result);
    }
  }
  

  fetchData = async () => {
    let runtimes = this.state.runtimes;
    let services = this.state.services;
    if (!runtimes) {
      const src = new URLSearchParams(document.location.search).get('src');
      const { 
        runtimes: restoredRuntimes, 
        services: restoredServices,
        sidechainRouting  
      } = src ? await this.importBoard(src) : this.restoreBoard();
      runtimes = restoredRuntimes || [];
      services = restoredServices || {};
      this.setState({ 
        runtimes, 
        services,
        sidechainRouting,
      });
    }
    
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles); 
    }

    const availableServices = this.defaultRegistry.availableServices
      .filter(s => serviceWhitelist.indexOf(s.serviceId) !== -1);

    const data = {
      board: { name: 'Playground' },
      runtimes, 
      services,
      registry: runtimes && runtimes.reduce(
        (all, rt) => ({ ...all, [rt.id]: availableServices }), 
        {}
      ),
    };
    return data;
  }

  renderRuntimes = boardContext => {
    const { runtimes } = boardContext;
    const { 
      showSidechainSelector, 
      sidechainRouting, 
      services,
    } = this.state;
    return (
      <div style={s(t.w100)}>
      {
        runtimes.map(runtime => 
          <DragProvider
            key={`playground-drag-provider-${runtime.id}`}
            style={{ marginBottom: 10, marginTop: 10 }}
          >
            <Runtime
              key={`sandbox-playground-${runtime.id}`}
              ref={rt => this.runtimeInstances[runtime.id] = rt}
              boardContext={boardContext}
              runtime={runtime}
              onResult={this.onResult.bind(this, runtime)}
              customItems={[
                {
                  key: `sidechain-option-${runtime.id}`,
                  icon: 'location arrow',
                  onClick: () => this.setState({ showSidechainSelector: runtime.id })
                }
              ]}
            >
            {
              showSidechainSelector === runtime.id && (
                <SidechainSelector
                  key={`sidechain-selector-${runtime.id}`}
                  runtimes={runtimes}
                  services={services} 
                  onClose={() => this.setState({ showSidechainSelector: false })}
                  onSelect={routing => 
                    this.setState({ 
                      sidechainRouting: {
                        ...sidechainRouting,
                        [runtime.id]: routing,
                      },
                    })
                  }
                  routing={sidechainRouting[runtime.id]}
                />
              )
            }
            </Runtime>
          </DragProvider>
        )
      }
      </div>
    );
  }

  renderPlaceholder = () => {
    const { placeholderAnimationRunning } = this.state;
    if (!placeholderAnimationRunning) {
      setTimeout(() => 
        this.setState({ placeholderAnimationRunning: true }),
        0
      );
    }
    return (
      <div 
        style={s(
          t.fill, 
          { 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
          },
          { 
            opacity: placeholderAnimationRunning ? 1 : 0,
            transition: placeholderAnimationRunning && 'opacity 5s 1s'
          }
        )}
      >
        <Icon 
          style={{ opacity: 0.6 }} 
          name="leaf" 
          size="massive" 
          color="grey" 
        />
        <div 
          style={s(t.uc, t.fs13, t.ls1, t.m(0, 30))}>      
          It is empty here, add a runtime to get going ...
        </div>        
      </div>
    );
  }

  renderPlayground = boardContext => {
    const { 
      persistBoard, 
    } = this.state;
    return (
      <div>
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

  render() {
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
              { 
                boardContext && 
                boardContext.runtimes && 
                boardContext.runtimes.length === 0 ? 
                  this.renderPlaceholder() : 
                  this.renderPlayground(boardContext)
              }
            </div>
          )
        }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}