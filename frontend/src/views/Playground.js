import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from 'semantic-ui-react';
import { generate } from 'unique-names-generator';
import uuid from 'uuid';

import { redirectTo } from '../core/actions';
import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Runtime from '../components/Runtime';
import SidechainSelector from '../components/SidechainSelector';
import DragProvider from '../DragContext';
import { s, t } from '../styles';
import BrowserRegistry from '../runtime/BrowserRegistry';
import { filterPrivateMembers } from '../runtime/services/helpers';
import Prompt from '../components/Prompt';

const defaultBundles = [
  'hookup.to/registry/browser/Audio',
  'hookup.to/registry/browser/Graphic',
  'hookup.to/registry/browser/FileStorage'
];

const allowedServices = [
  'hookup.to/service/timer',
  'hookup.to/service/monitor',
  'hookup.to/service/canvas',
  'hookup.to/service/map',
  'hookup.to/service/camera',
  'hookup.to/service/injector',
  'hookup.to/service/trigger-pad',
  'hookup.to/service/sound',
  'hookup.to/service/audio-output',
  'hookup.to/service/microphone',
  'hookup.to/service/gif-encoder',
  'hookup.to/service/thrower',
  'hookup.to/service/receiver',
];

const defaultName = 'Playground';

function generateRandomName() {
  return generate('-').split('-').slice(1).join('-');
}

export default class Playground extends Component {
  state = {
    boardName: (this.props.match && this.props.match.params) ? this.props.match.params.board : defaultName,
    showSidechainSelector: false,
    sidechainRouting: {},
    placeholderAnimationRunning: false,
    runtimes: undefined,
    services: undefined,
  };

  user = { 
    username: 'Anonymous',
    userId: undefined,
  };
  
  availableRuntimes = [
    { name: 'browser', args: 'browser' },
  ];

  runtimeInstances = {};

  componentDidUpdate(prevProps) {
    const board = this.props.match.params.board; 
    const prevBoard = prevProps.match.params.board; 
    if (board !== prevBoard) {
      if (board === undefined) {
        this.setState({ 
          boardName: defaultName, 
          runtimes: undefined, 
          services: undefined,
          sidechainRouting: {}
        });
      } else {
        this.setState({ boardName: board });
      }
    }
  }

  isInitialFetch = () => this.state.runtimes === undefined;

  fetchData = async () => {
    if (this.isInitialFetch()) {
      await this.setInitialPlayground();
    }
    const { 
      boardName='Playground',
      runtimes=[], 
      services={},
    } = this.state;
     
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles); 
    }

    const data = {
      board: { name: boardName },
      runtimes, 
      services,
      registry: runtimes && runtimes.reduce(
        (all, rt) => ({ ...all, [rt.id]: this.defaultRegistry.availableServices }), 
        {}
      ),
    };
    return data;
  }

  setInitialPlayground = () => {
    const { board } = this.props.match.params;
    if (board) {
      return this.restoreBoard(board);
    } 
    const queryParams = new URLSearchParams(document.location.search);
    const src = queryParams.get('src');
    if (src) {
      this.importBoard(src)
    }
  }

  importBoard = async url => {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const runtimeIds = Object.keys(data);

      this.setState({ 
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
      });
    } catch (err) {
      console.log('Import failed', err, url)
    }
  }

  restoreBoard = name => {
    const storageName = name ? `hkp-playground-${name}` : 'hkp-playground';
    const data = localStorage.getItem(storageName);
    if (data) {
      const state = JSON.parse(data);
      this.setState(state);
    } 
  }

  storeBoard = name => {
    const { 
      runtimes=[], 
      services={}, 
      sidechainRouting={},
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
    localStorage.setItem(`hkp-playground-${name}`, JSON.stringify(data));
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

  newBoard = () => {
    const name = generateRandomName();
    redirectTo(`/playground/${name}`);
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
    const { runtimes=[] } = this.state;
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
      return; // runtimes with routings aren't further processed
    }
    const nextRuntime = this.getNextRuntime(runtime);
    if (nextRuntime) {
      nextRuntime.processRuntime(result);
    }
  }
  
  saveBoard = async () => {
    if (this.prompt) {
      const suggested = (this.props.match && this.props.match.params) ? 
        this.props.match.params.board : 
        generateRandomName();
      const name = await this.prompt.getInput('Enter a name for the board', suggested);
      if (name !== null) {
        this.storeBoard(name);
      }
      if (name !== suggested) {
        redirectTo(`/playground/${name}`);
      }
    }
  }

  getSavedBoards = () => {
    const savedBoards = [];
    const prefix = 'hkp-playground-';
    for(const key in localStorage) {
      if (key.startsWith(prefix)) {
        savedBoards.push({
          key: key.substr(prefix.length), 
          value: localStorage.getItem(key)
        });
      }
    }
    return savedBoards;
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
              allowedServices={allowedServices}
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

  renderPlaceholder = (boardContext) => {
    const { placeholderAnimationRunning } = this.state;
    if (!placeholderAnimationRunning) {
      setTimeout(() => 
        this.setState({ placeholderAnimationRunning: true }),
        0
      );
    }
    const savedBoards = this.getSavedBoards();
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
        <div style={s(t.uc, t.fs13, t.ls1, t.m(0, 30))}>      
          It is empty here, add a runtime to get going ...
          {
            savedBoards.length > 0 && (
                <div>
                  Or restore a saved boards, like:
                  <div>
                  {
                    savedBoards.map((item, idx) => (
                      <span
                        style={{ color: '#4183c4', cursor: 'pointer' }}
                        key={`stored-preset-${item.key}`}
                      >
                        <Link to={`/playground/${item.key}`}>
                        {
                          `${item.key}${idx+1 < savedBoards.length ? ', ' : ''}` 
                        }
                        </Link>
                      </span>
                    ))
                  }
                  </div>
                </div>
            )
          }
        </div>
      </div>
    );
  }

  renderPlayground = boardContext => {
    return (
      <div>
        { this.renderRuntimes(boardContext) }
        <Prompt ref={prompt => this.prompt = prompt} />
      </div>
    )
  };

  isActionAvailable = action => {
    switch (action) {
      case 'shareBoard':
        return false;
      case 'saveBoard':
      case 'clearBoard':
        return this.state.runtimes;
      default:
        return true;
    }
  }

  render() {
    const { boardName } = this.state;
    return (
      <BoardProvider
        key={`playground-${boardName}`}
        user={this.user}
        boardName={boardName}
        fetchData={this.fetchData}
        isRuntimeInScope={() => true}
        addRuntime={this.addRuntime}
        removeRuntime={this.removeRuntime}
        addService={this.addService}
        removeService={this.removeService}
        newBoard={this.newBoard}
        clearBoard={this.clearPlayground}
        saveBoard={this.saveBoard}
        arrangeService={this.arrangeService}
        isActionAvailable={this.isActionAvailable}
      >
        <BoardConsumer>
        {
          boardContext => (
            <div style={t.fill}>
              <Toolbar
                board={boardName}
                availableRuntimes={this.availableRuntimes}
              />
              { 
                boardContext && 
                boardContext.runtimes && 
                boardContext.runtimes.length === 0 ? 
                  this.renderPlaceholder(boardContext) : 
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