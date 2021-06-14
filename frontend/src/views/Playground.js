import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Icon,
  Button,
  Message,
} from 'semantic-ui-react';
import { generate } from 'unique-names-generator';
import uuid from 'uuid';

import { redirectTo } from '../core/actions';
import BoardProvider, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';
import Runtime from '../components/Runtime';
import SidechainSelector from '../components/SidechainSelector';
import DragProvider from '../DragContext';
import { s, t } from '../styles';
import BrowserRegistry from '../runtime/BrowserRegistry';
import { filterPrivateMembers } from '../runtime/services/helpers';
import Prompt from '../components/Prompt';
import VSpacer from '../components/shared/VSpacer';
import BoardCollection from '../components/BoardCollection';
import OutputSelector from '../components/shared/OutputSelector';
import InputSelector from '../components/shared/InputSelector';
import PeersProvider, { PeersConsumer } from '../PeersContext';
import Peer from '../components/Peer';

import { replacePlaceholders } from '../core/url';

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
  'hookup.to/service/filter',
  'hookup.to/service/camera',
  'hookup.to/service/injector',
  'hookup.to/service/trigger-pad',
  'hookup.to/service/sound',
  'hookup.to/service/audio-output',
  'hookup.to/service/audio-input',
  'hookup.to/service/gif-encoder',
  'hookup.to/service/input',
  'hookup.to/service/output',
  'hookup.to/service/thrower',
  'hookup.to/service/receiver',
  'hookup.to/service/downloader',
  'hookup.to/service/mp3encoder',
  'hookup.to/service/reduce',
  'hookup.to/service/chart',
  'hookup.to/service/spotify',
  'hookup.to/service/github',
];

const defaultName = 'Playground';

function generateRandomName() {
  return generate('-').split('-').slice(1).join('-');
}

function getSavedBoards() {
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
 
export default class Playground extends Component {
  state = {
    boardName: (this.props.match && this.props.match.params) ? this.props.match.params.board : defaultName,
    showRoutingOptions: false,
    sidechainRouting: {},
    //boardRouting: {},
    placeholderAnimationRunning: false,
    runtimes: undefined,
    services: undefined,
    description: '',
    initialFetched: false,
    savedBoards: getSavedBoards(),
    inputRouting: {},
    outputRouting: {}
  };

  user = { 
    username: 'Anonymous',
    userId: undefined,
  };
  
  availableRuntimes = [
    { name: 'browser', args: 'browser' },
  ];

  runtimeInstances = {};

  externalInputs = {};

  inputSelectors = {};

  componentDidUpdate(prevProps) {
    const board = this.props.match.params.board; 
    const prevBoard = prevProps.match.params.board; 
    if (board !== prevBoard) {
      if (board === undefined) {
        this.setState({ 
          boardName: defaultName, 
          runtimes: undefined, 
          services: undefined,
          sidechainRouting: {},
          description: '',
          initialFetched: false,
        });
      } else {
        this.setState({ 
          boardName: board,
          initialFetched: false,
        });
      }
    }
  }

  componentWillUnmount() {
    this.clearPlayground();
  }

  fetchData = async () => {
    const {
      boardName='Playground',
      runtimes=[], 
      services={},
      description='',
    } = this.state.initialFetched ? this.state : await this.setInitialPlayground();
     
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
    this.setState({ ...data, initialFetched: true, description });
    return data;
  }

  setInitialPlayground = () => {
    const queryParams = new URLSearchParams(document.location.search);
    const { board } = this.props.match.params;
    if (board) {
      const template = queryParams.get('template');
      if (template) {
        return this.createBoardFromTemplate(template);
      } else {
        const localBoard = this.restoreBoardFromLocalStorage(board);
        if (localBoard) {
          return localBoard;
        }
        return this.state; // use initial state 
      }
    } 
    
    const src = queryParams.get('src');
    if (src) {
      return this.importBoard(src);
    }

    return {};
  }

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

  createBoardFromTemplate = async name => {
    const resp = await fetch(`/boards/templates/${name}.json`);
    if (resp && resp.ok) {
      try {
        const template = await resp.json();
        const { 
          runtimes, 
          services, 
          sidechainRouting, 
          description
        } = template;
        const patchedRuntimes = runtimes.map(rt => ({
          ...rt, id: uuid.v4() 
        }));
        return this.restoreBoard({ 
          runtimes: patchedRuntimes,
          services: patchedRuntimes.reduce(
            (all, rt, idx) => ({ 
              ...all, 
              [rt.id]: services[runtimes[idx].id].map(svc => ({ uuid: uuid.v4(), ...svc }))
            }),
            {}
          ),
          sidechainRouting: patchedRuntimes.reduce(
            (all, rt, idx) => ({ ...all, [rt.id]: sidechainRouting[runtimes[idx].id] }),
            {}
          ),
          description
        });
      } catch (err) {
        console.error('Creating from template failed', name);
      }      
    }
  }

  restoreBoardFromLocalStorage = name => {
    const storageName = name ? `hkp-playground-${name}` : 'hkp-playground';
    const data = localStorage.getItem(storageName);
    if (data) {
      return this.restoreBoard(data);
    }
  }

  restoreBoard = objOrString => {
    return typeof objOrString === 'string' ? 
      JSON.parse(objOrString) : 
      objOrString;
  }

  storeBoard = name => {
    const { 
      runtimes=[], 
      services={}, 
      sidechainRouting={},
      //boardRouting={}
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
      //boardRouting,
    };
    localStorage.setItem(`hkp-playground-${name}`, JSON.stringify(data));
  }

  getRuntimeById = runtimeId => {
    const { runtimes=[] } = this.state;
    const runtime = runtimes.find(rt => rt.id === runtimeId);
    if (!runtime) {
      console.error('Unknown runtime', runtimeId, runtimes);
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

  destroyRuntime = runtime => {
    const externalInput = this.externalInputs[runtime.id];
    if (externalInput) {
      externalInput.close();
      delete this.externalInputs[runtime.id];
    }

    const rt = this.getRuntimeById(runtime.id);
    if (!rt) {
      return;
    }

    return rt.destroyRuntime();
  }

  removeRuntime = async runtime => {
    await this.destroyRuntime(runtime);

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

  clearPlayground = async () => {
    const { runtimes=[] } = this.state;
    for (const runtime of runtimes) {
      await this.destroyRuntime(runtime);
    }

    for (const ext of Object.keys(this.externalInputs)) {
      this.externalInputs[ext].close();
    }
    this.externalInputs = [];
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
    const { 
      sidechainRouting,
      //boardRouting,
      boardName,
    } = this.state;
    const sroute = sidechainRouting && sidechainRouting[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dst = this.runtimeInstances[route.runtimeId];
        await dst.configureService(route.serviceUuid, result);
      }
      return; // runtimes with routings aren't further processed
    }

    const nextRuntime = this.getNextRuntime(runtime);
    if (nextRuntime) {
      nextRuntime.processRuntime(result);
    } else {
      // TODO: !!! not so!
      const outputRouting = this.state.outputRouting || {};
      const dst = outputRouting[runtime.id];
      if (dst && this.peerContext) {
        this.peerContext.sendData(
          `${boardName}-${runtime.name}`, 
          dst,
          result
        );
      }
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
        if (name !== suggested) {
          redirectTo(`/playground/${name}`);
        }
      }
    }
  }

  renderOutputs = (peers, runtime, onUpdatePeers) => {
    return (
      <OutputSelector
        items={peers}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
        onSelect={value => this.setState({ 
          outputRouting: {
            ...this.state.outputRouting,
            [runtime.id]: value
          }
        })}
        onUpdate={onUpdatePeers}
      />
    );
  }

  renderInputs = (peers, runtime, onUpdatePeers) => (
    <InputSelector
      ref={selector => this.inputSelectors[runtime.id] = selector}
      items={peers}
      onUpdate={onUpdatePeers}
      onSelect={value => this.setState({ 
          inputRouting: {
            ...this.state.inputRouting,
            [runtime.id]: value
          }
        })
      }
    />
  );

  renderRuntime = (boardContext, runtime, peers) => {
    const {
      boardName,
      showRoutingOptions, 
      sidechainRouting,
      //boardRouting, 
      services,
    } = this.state;

    const ownPeers = boardContext.runtimes.map(rt => `${boardName}-${rt.name}`);
    const filteredPeers = peers.peerNames.filter(x => ownPeers.indexOf(x) === -1);
    return (
      <DragProvider
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
              onClick: () => this.setState({ showRoutingOptions: runtime.id })
            }
          ]}
          allowedServices={allowedServices}
          outputs={this.renderOutputs(filteredPeers, runtime, peers.updatePeers)}
          inputs={this.renderInputs(filteredPeers, runtime, peers.updatePeers)}
        >
        {
          showRoutingOptions === runtime.id && (
            <div 
              key={`routing-options-${runtime.id}`}
              style={{ 
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'row'}}>
                <Button
                  onClick={() => this.setState({ showRoutingOptions: false })}
                  style={s(t.uc, t.fs12, t.ls1, { height: 28, width: 32, marginLeft: 'auto', borderRadius: 2 })}
                  icon="close"
                />
              </div>
              <SidechainSelector
                key={`sidechain-selector-${runtime.id}`}
                runtimes={boardContext.runtimes}
                services={services}
                routing={sidechainRouting[runtime.id]}
                onSelect={routing => 
                  this.setState({ 
                    sidechainRouting: {
                      ...sidechainRouting,
                      [runtime.id]: routing,
                    },
                  })
                }
              />
            </div>
          )
        }
        </Runtime>
      </DragProvider>
    );
  }

  renderRuntimes = boardContext => {
    const { runtimes } = boardContext;
    const { boardName } = this.state;
    return (
      <div style={s(t.w100)}>
        <PeersProvider ref={ctx => this.peerContext = ctx}>
          <PeersConsumer> 
          { 
            peers => runtimes.map((runtime, rtidx) => {
              return (
                <Peer 
                  key={`playground-peer-${runtime.id}`}
                  name={`${boardName}-${runtime.name}`}
                  onData={envelope => {
                    const { sender, data } = envelope;
                    const input = this.state.inputRouting[runtime.id];
                    if (input === '*' || input === sender) {
                      const rt = this.getRuntimeById(runtime.id);
                      if (rt) {
                        rt.processRuntime(data);
                      }                      
                    } else {
                      const selector = this.inputSelectors[runtime.id];
                      if (selector) {
                        selector.signalIncoming(sender);
                      }
                    }
                  }}
                >
                  { this.renderRuntime(boardContext, runtime, peers) }
                </Peer>
              )
            })
          } 
          </PeersConsumer>
        </PeersProvider>
      </div>
    );
  }

  renderDescription = () => {
    const { description } = this.state;
    if (description) {
      const arr = Array.isArray(description) ? description : [description];
      const renderItem = (item, idx) => {
        const key = `template-description-item-${idx}`;
        switch (item.type) {
          case 'headline':
            return (
              <h1 
                key={key}
                style={s(t.fs14, t.uc, t.ls1, t.tc)}
              >
                {item.text}
              </h1>
            );
          case 'check': {
            const { url: rawUrl, text } = item;
            const url = replacePlaceholders(rawUrl);
            const urlKey = `check-${url}`;
            const checkPassed = this.state[urlKey];
            if (checkPassed  === undefined) {
              fetch(url)
                .then(resp => this.setState({ [urlKey]: resp.ok }))
                .catch(err => this.setState({ [urlKey]: false }));
            }
            return (
              <div key={key} style={s(t.uc, t.fs12, t.ls1)}>
                { text }  { checkPassed ? '✅' : '❌' }
              </div>
            );
          }
          default: 
            return (
              <div 
                key={key}
                style={s(t.uc, t.fs12, t.ls1)}
              >
                {item}
              </div>
            );
        }
      }
      return (
        <div style={{ margin: '10px 0' }}>
          <Message 
            style={{ 
              padding: '15px 30px',
              color: '#555', 
              backgroundColor: 'rgba(172, 200, 229, 0.01)',
            }}
          >
            { arr.map(renderItem) }
          </Message>
        </div>
      );
    }
  }

  renderPlaceholder = boardContext => {
    const { savedBoards=[], boardName } = this.state;
    const headlineStyle = t.fs14;
    return (
      <div style={t.fill}>
        <div style={s(t.uc, t.fs13, t.ls1, t.m(20))}>
          { 
            !boardName && 
            <h1 style={headlineStyle}> Sketch something new </h1>
          } 
          <div style={s(t.tc, t.mt30, t.mb30)}>
            <Icon 
              style={{ opacity: 0.6 , marginTop: 30, marginBottom: 30 }} 
              name="leaf" 
              size="massive" 
              color="grey" 
            />
          </div>
          <div style={t.tc}>
            This is an empty playground - add a runtime to get going!
          </div>
          { 
            !boardName && (
              <div> 
                <div style={t.m(0, 40)}>
                  <h1 style={headlineStyle}> Hookup a reflector </h1>
                  <div>
                    {
                      [ 
                        { name: 'Sender', template: 'reflector-sender' },
                        { name: 'Receiver', template: 'reflector-receiver' },
                      ].map((item, idx, self) => (
                        <Link
                          key={`template-${item.name}`}
                          to={`/playground/${generateRandomName()}?template=${item.template}`}>
                          {`${item.name}${(idx + 1 < self.length) ? ', ' : ''} `}
                        </Link>
                      ))
                    }
                  </div>
                </div>
                {
                  savedBoards.length > 0 && (
                    <div style={s(t.mt20)}>
                      <h1 style={headlineStyle}> Following boards were saved in this browser</h1>
                      <BoardCollection 
                        style={{ height: 250, width: '100%', marginRight: 20 }}
                        url={name => `/playground/${name}`} 
                        savedBoards={savedBoards}
                      />
                    </div>
                  )
                }
              </div>
            )
          }
        </div>
        <VSpacer />
      </div>
    );
  }

  renderPlayground = boardContext => {
    return (
      <div>
        { this.renderRuntimes(boardContext) }
        { this.renderDescription() }
        <Prompt ref={prompt => this.prompt = prompt} />
        <VSpacer />
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

  renderContent = boardContext => {
    if (!this.state.initialFetched) {
      return (
        <div style={s(t.uc, t.ls1, { 
            position: 'absolute',
            left: '50%',
            top: '50%',
          })}
        >
          Loading ...
        </div>
      );
    }
    return (boardContext && 
            boardContext.runtimes && 
            boardContext.runtimes.length === 0) ? 
              this.renderPlaceholder(boardContext) : 
              this.renderPlayground(boardContext);
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
        shareBoard={this.shareBoard}
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
              { this.renderContent(boardContext) }
              <Footer />
            </div>
          )
        }
        </BoardConsumer>
      </BoardProvider>
    );
  }
}