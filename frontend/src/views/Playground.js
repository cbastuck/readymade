import React, { Component } from 'react';
import { 
  Icon,
  Button,
  Message,
  Loader, 
} from 'semantic-ui-react';
import uuid from 'uuid';
import qs from 'query-string';

import Editor from '../components/shared/Editor/index';
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
import SaveBoardPrompt from '../components/SaveBoardPrompt';
import VSpacer from '../components/shared/VSpacer';
import BoardCollection from '../components/BoardCollection';
import OutputSelector from '../components/shared/OutputSelector';
import InputSelector from '../components/shared/InputSelector';
import PeersProvider, { PeersConsumer } from '../PeersContext';
import Peer from '../components/Peer';
import QR from '../components/QR';
import Copyable from '../components/Copyable';

import { replacePlaceholders } from '../core/url';
import { generateRandomName } from '../core/board';

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
  'hookup.to/service/github-source',
  'hookup.to/service/github-sink',
  'hookup.to/service/cache',
];

const usecasesUrl = 'https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/index.json';
const defaultName = 'Playground';
const headlineSpace = 6;



function getSavedBoards() {
  const savedBoards = [];
  const prefix = 'hkp-playground-';
  for(const key in localStorage) {
    if (key.startsWith(prefix)) {
      savedBoards.push({
        name: key.substr(prefix.length), 
        value: JSON.parse(localStorage.getItem(key))
      });
    }
  }
  return savedBoards;
}

function getActivationId(runtimeId) {
  return `peer-${runtimeId}-active`;
}

export default class Playground extends Component {
  state = {
    boardName: (this.props.match && this.props.match.params && this.props.match.params.board) || defaultName,
    showRoutingOptions: false,
    sidechainRouting: {},
    placeholderAnimationRunning: false,
    runtimes: undefined,
    services: undefined,
    description: '',
    initialFetched: false,
    savedBoards: getSavedBoards(),
    inputRouting: {},
    outputRouting: {},
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
          outputRouting: {},
          inputRouting: {},
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
      boardName=defaultName,
      runtimes=[], 
      services={},
      description='',
      sidechainRouting={},
      outputRouting={},
      inputRouting={},
    } = this.state.initialFetched ? this.state : await this.setInitialPlayground();
     
    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles); 
    }

    const inputActivationIds = inputRouting ? 
      Object.keys(inputRouting).reduce(
        (a, c) => ({
          ...a,
          [getActivationId(c)]: true
        }),
        {}
      ) : 
      {};

    const outputActivationIds = outputRouting ? 
      Object.keys(outputRouting).reduce(
        (a, c) => ({
          ...a,
          [getActivationId(c)]: true
        }),
        {}
      ) : 
      {};

    const data = {
      board: { name: boardName },
      runtimes,
      services,
      registry: runtimes && runtimes.reduce(
        (all, rt) => ({ ...all, [rt.id]: this.defaultRegistry.availableServices }), 
        {}
      ),
      sidechainRouting,
      outputRouting,
      inputRouting,
    };
    this.setState({ 
      ...data, 
      ...inputActivationIds,
      ...outputActivationIds,
      initialFetched: true, 
      description,
    });
    return data;
  }

  setInitialPlayground = () => {
    const queryParams = new URLSearchParams(document.location.search);
    const { board } = this.props.match.params;
    if (board) {
      const params = qs.parse(document.location.search);
      if (params.template) {
        return this.createBoardFromTemplate(params.template, params);
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

  createBoardFromTemplate = async (templateUrl, params) => {
    const resp = await fetch(templateUrl);
    if (resp && resp.ok) {
      try {
        const template = await resp.json();
        const { 
          runtimes, 
          services, 
          sidechainRouting, 
          description,
          inputRouting,
          outputRouting,
        } = template;
        const patchedRuntimes = runtimes.map(rt => ({
          ...rt, id: uuid.v4() 
        }));
        const patchedServices = patchedRuntimes.reduce((all, rt, idx) => ({ 
            ...all, 
            [rt.id]: services[runtimes[idx].id].map(svc => ({ uuid: uuid.v4(), ...svc }))
          }),
          {}
        );
        return {
          runtimes: patchedRuntimes,
          services: patchedServices,
          sidechainRouting: sidechainRouting ? 
            patchedRuntimes.reduce(
              (all, rt, idx) => {
                const entries = sidechainRouting[runtimes[idx].id];
                const entry = entries && entries[0]; // TODO: we're only take the first HOTFIX
                if (!entry) {
                  return all;
                }
                const origRTIndex = runtimes.findIndex(r => r.id === entry.runtimeId);
                const origSvcIndex = services[runtimes[idx].id].findIndex(svc => svc.uuid === entry.serviceUuid);
                return { 
                  ...all, 
                  [rt.id]: [ // TODO: we're only taking the first sidechain entry HOTFIX
                    {
                      runtimeId: patchedRuntimes[origRTIndex].id,
                      serviceUuid: patchedServices[rt.id][origSvcIndex].uuid,
                    }
                  ]
                }
              },
              {}
            ) : 
            {},
          inputRouting: inputRouting ? 
            patchedRuntimes.reduce(
              (all, rt, idx) => ({ ...all, [rt.id]: replacePlaceholders(inputRouting[runtimes[idx].id], params) }),
              {}
            ) : 
            undefined,
          outputRouting: outputRouting ? 
            patchedRuntimes.reduce(
              (all, rt, idx) => {
                const routing = outputRouting[runtimes[idx].id];
                return routing ? 
                  {
                    ...all,
                    [rt.id]: {
                      ...routing,
                      peer: replacePlaceholders(routing.peer, params)
                    } 
                  } : 
                  all
              },
              {}
            ) :
            undefined,
          description,
        };
      } catch (err) {
        console.error('Creating from template failed', templateUrl, err);
      }      
    }
  }

  restoreBoardFromLocalStorage = name => {
    const storageName = name ? `hkp-playground-${name}` : 'hkp-playground';
    const data = localStorage.getItem(storageName);
    if (data) {
      return JSON.parse(data);
    }
  }

  storeBoard = (name, description) => {
    const { 
      runtimes=[], 
      services={}, 
      sidechainRouting={},
      outputRouting={},
      inputRouting={}
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
      outputRouting,
      inputRouting,
      description,
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

  setRuntimeName = (runtimeId, newName) => {
    this.setState({
      runtimes: this.state.runtimes.map(rt => 
        rt.id === runtimeId ? ({ ...rt, name: newName }) : rt
      )
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
      boardName,
      outputRouting={},
    } = this.state;
    const sroute = sidechainRouting && sidechainRouting[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dst = this.runtimeInstances[route.runtimeId];
        if (dst) {
          await dst.configureService(route.serviceUuid, result);
        } else {
          console.error('Playground.onResult() sidechain destination not found', route.runtimeId, this.runtimeInstances);
        }
      }
    }
    const runtimeOutput = outputRouting[runtime.id] || {};
    const flow = (runtimeOutput &&  runtimeOutput.flow) || 'pass';
    if (flow === 'pass') {
      const nextRuntime = this.getNextRuntime(runtime);
      if (nextRuntime) {
        nextRuntime.processRuntime(result);
      }
    }
     
    if (runtimeOutput.peer && this.peerContext) {
      this.peerContext.sendData(
        `${boardName}-${runtime.name}`, 
        runtimeOutput.peer,
        result
      );
    }
  }
  
  saveBoard = async () => {
    if (this.prompt) {
      const suggested = (this.props.match && this.props.match.params) ? 
        this.props.match.params.board : 
        generateRandomName();
      const value = await this.prompt.getInput(suggested);
      if (value !== null) {
        const { name, description } = value;
        this.storeBoard(name, description);
        if (name !== suggested) {
          redirectTo(`/playground/${name}`);
        }
      }
    }
  }

  closeSourceView = () => {
    const { pathname } = window.location;
    redirectTo(pathname.split('/').slice(0, -1).join('/'));
  }

  renderOutputs = (peers, runtime, onUpdatePeers) => {
    const outputRouting = this.state.outputRouting[runtime.id] || {};
    return (
      <OutputSelector
        items={peers}
        initialValue={outputRouting.peer}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
        onSelect={peer => this.setState({ 
          outputRouting: {
            ...this.state.outputRouting,
            [runtime.id]: {
              ...outputRouting,
              peer
            }
          }
        })}
        onAction={action => {
          switch (action.type) { 
            case OutputSelector.updatePeersAction: {
              const activationId = getActivationId(runtime.id);
              if (!this.state[activationId]) {
                this.setState({ [activationId]: true });
              } else {
                onUpdatePeers();
              }
              break;
            }
            case OutputSelector.flowChanged:
              return this.setState({
                outputRouting: {
                  ...this.state.outputRouting,
                  [runtime.id]: {
                    ...outputRouting,
                    flow: action.flow
                  }
                }
              });
            default:
              break;
          }
        }}
        flow={outputRouting.flow}
      />
    );
  }

  renderInputs = (peers, runtime, onUpdatePeers) => {
    const activationId = getActivationId(runtime.id);
    const isPeerActive = !!this.state[activationId];
    const inputRouting = this.state.inputRouting && this.state.inputRouting[runtime.id];
    return (
      <InputSelector
        ref={selector => this.inputSelectors[runtime.id] = selector}
        items={peers}
        initialValue={inputRouting}
        onAction={action => {
          switch (action.type) {
            case InputSelector.updatePeersAction:
              return onUpdatePeers();
            default:
              break;
          }
        }}
        onSelect={value => this.setState({ 
            inputRouting: {
              ...this.state.inputRouting,
              [runtime.id]: value
            }
          })
        }
        disabled={!isPeerActive}
      >
        <div 
          style={{ 
            color: '#4183c4',
            cursor: 'pointer',
            textAlign: 'center'
          }}
          onClick={() => this.setState({ 
            [activationId]: true
          })}
        >
          { !isPeerActive ? 'Click to enable' : false }
        </div>
      </InputSelector>
    )
  };

  renderRuntime = (boardContext, runtime, peers) => {
    const {
      boardName,
      showRoutingOptions, 
      sidechainRouting,
      services,
    } = this.state;

    const ownPeers = boardContext.runtimes.map(rt => `${boardName}-${rt.name}`);
    const filteredPeers = peers.peerNames.filter(x => ownPeers.indexOf(x) === -1);
    return (
      <DragProvider style={{ marginBottom: 10, marginTop: 10 }}>
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
    const { boardName } = this.state;
    return (
      <div style={s(t.w100)}>
        <PeersProvider ref={ctx => this.peerContext = ctx}>
          <PeersConsumer> 
          { 
            peers => runtimes.map((runtime, rtidx) => {
              const isPeerActive = !!this.state[getActivationId(runtime.id)];
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
                  active={isPeerActive}
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
    const { description, boardName } = this.state;
    if (description) {
      const arr = Array.isArray(description) ? description : [description];
      const renderItem = (item, idx) => {
        const key = `template-description-item-${idx}`;
        if (typeof item === 'string') {
          return <div key={key} style={s(t.uc, t.fs12)}> {item} </div>;
        }
        if (Array.isArray(item)) {
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'row' }}>
              { item.reduce((a, c) => [...a, c, <span>&nbsp;</span>], []).map((x, y) => renderItem(x, `${idx}.${y}`)) }
            </div>
          );
        }
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
          case 'link': {
            const {
              text='text property missing', 
              href='#' 
            } = item;
            return (
              <a 
                key={key}
                href={href} 
                target="_blank" rel="noreferrer"
                style={s(t.uc, t.fs12, t.ls1)}
              > 
                { text }
              </a>
            );
          }
          case 'vspace': {
            const { size } = item;
            return <div key={key} style={{ height: size }} />;
          }
          case 'qr': {
            const { href='#' } = item;
            const params = qs.parse(document.location.search);
            const url = replacePlaceholders(href, { board: boardName, ...params });
            return (
              <div key={key} style={{ margin: 'auto', textAlign: 'center' }}>
                <QR url={url} />
                <div style={{ width: '60%', margin: 'auto' }}>
                  <Copyable
                    label="url"
                    value={url}
                  />
                </div>
              </div>
            );
          }
          case 'text':
            const { 
              value,
              alignment='left',
            } = item;
            const alig = alignment === 'left' ? 
              t.tl : 
              (alignment === 'center' ? 
                t.tc :
                t.tr
              );
            return <div key={key} style={s(t.uc, t.fs12, alig)}> {value} </div>;
          default:
            console.error('Unsupported description type', item);
            return (
              <div 
                key={key}
                style={s(t.uc, t.fs12, t.ls1)}
              >
                { item }
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

  renderSketchOption = headline => {
    const { boardName } = this.state;
    const isDefaultBoard = boardName === defaultName;
    return (
      <div 
        style={{ 
          border: headline && 'solid 1px lightgray',
          borderRadius: headline && 3,
          margin: headline && '15px 0px',
        }}
      >
        { 
          headline && (
            <div style={{ marginTop: 20 }}>
              <h1 style={s(t.fs14, t.tc, t.m(0, headlineSpace))}> —{headline}— </h1> 
            </div>
          )
        }
        <div 
          style={{ padding: headline && '20px 0px' }}
        >
          <div style={s(t.tc, t.mt0, t.mb30)}>
            <Icon 
              style={{ opacity: 0.6 , marginTop: 30, marginBottom: 30 }} 
              name="leaf" 
              size="massive" 
              color="grey" 
            />
          </div>
          <div style={t.tc}>
            { 
              isDefaultBoard ? 
                'This is an empty playground - ' : 
                (<span>Playground <span style={t.italic}>{boardName}</span> is empty - </span>)
            }
            <span 
              style={{ cursor: 'help', color: '#4284C4'}}
              onClick={() => {
                const selector = document.getElementById('runtime-dropdown');
                if (selector) {
                  selector.focus();
                  selector.click();
                }
              }}
            > 
              { ' add a runtime ' } 
            </span> 
            to get going!
          </div>
        </div>
      </div>
    )    
  }

  renderUsecases = () => {
    const { usecases } = this.state;
    const internalUsecases = [
    ];
    if (!usecases) {
      fetch(usecasesUrl)
        .then(resp => resp.json())
        .then(usecases => this.setState({ 
          usecases: internalUsecases.concat(usecases.map(item => ({
              ...item, 
              url: replacePlaceholders(`/playground/${generateRandomName()}?template=${item.template}`),
              metadata: 'use case',
              repo: item.repo,
            })
          ))
        }))
    }
    return (
      <div style={t.tc}>
        {
          usecases ? (
            <BoardCollection
              style={{ 
                height: 220, 
                width: '100%', 
                marginRight: 20,
              }}
              headline="—Launch a Usecase—"
              items={usecases}
            />
          ) : (
            <div>
              <Loader active inline>
                Loading Usecases ...
              </Loader>
            </div>
          )
        }
       
      </div>
    );
  }

  renderStoredBoards = savedBoards => {
    const items = savedBoards.map(item => ({ 
      ...item, 
      url: `/playground/${item.name}`,
      description: item.value.description
    }));
    return items.length > 0 && (
      <div style={s(t.mt20)}>
        <BoardCollection
          style={{ height: 250, width: '100%', marginRight: 20 }}
          headline="—Restore a board—"
          items={items}
        />
      </div>
    )
  }

  renderPlaceholder = boardContext => {
    const { savedBoards=[], boardName } = this.state;
    const showLoadPanel = boardName === defaultName;
    return (
      <div style={t.fill}>
        <div style={s(t.uc, t.fs13, t.ls1, t.tc, { width: '99%', margin: 'auto', marginTop: !showLoadPanel && '15%' })}>
          <h1 style={s(t.fs20, { margin: 0, marginTop: showLoadPanel ? 25 : 40 })}> Welcome to Playground</h1>
          { showLoadPanel && <h2 style={s(t.fs13, t.m(0, 0))}> Pick an option </h2> }
          { !showLoadPanel && this.renderSketchOption() }
          {
            showLoadPanel && (
              <div style={t.m(0, 30)}>
                { this.renderSketchOption('Sketch something new') }
                { this.renderUsecases() }
                { this.renderStoredBoards(savedBoards) }
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
        <SaveBoardPrompt ref={prompt => this.prompt = prompt} />
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

  renderSourceCode = boardName => {
    const { editSourceCode } = this.state;
    const src = this.restoreBoardFromLocalStorage(boardName) || '';
    if (editSourceCode) {
      return (
        <div style={{ height: '100%'}}>
          <Button 
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={() => {
              const src = this.editor.getValue();
              localStorage.setItem(`hkp-playground-${boardName}`, src);
              // this.closeSourceView();
            }}
          >
            Save
          </Button>
          <Button 
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={this.closeSourceView}
          >
            Close
          </Button>
          <Editor
            ref={editor => this.editor = editor}
            language="json"
            value={JSON.stringify(src, null, 2)}
          />
        </div>
      )
    }
    return (
      <div>
        <div style={{ position: 'sticky', top: 0, width: '100%', backgroundColor: 'white' }}>
          <Button
            style={s(t.mt10, t.mh(5), t.uc, t.ls1, t.fs12)}
            onClick={() => this.setState({ editSourceCode: true })}
          >
            Edit
          </Button>
          <Button 
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={this.closeSourceView}
          >
            Close
          </Button>
          <hr style={{ borderTop: '1px solid lightgray' }}/>
        </div>
        <div style={{ fontFamily: 'monospace', margin: 5 }}>    
          <pre> { JSON.stringify(src, null, 2) } </pre>
        </div>
      </div>
    );
  }

  renderContent = boardContext => {
    if (!this.state.initialFetched) {
      return (
        <div style={s(t.uc, t.ls1, { 
            position: 'absolute',
            left: '45%',
            top: '45%',
          })}
        >
          <Loader active inline>
            Loading Playground
          </Loader>
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
    const { pathname } = window.location;
    const lastPathItem = pathname.split('/').slice(-1)[0];
    if (lastPathItem === 'src') {
      return this.renderSourceCode(boardName);
    } 
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
        setRuntimeName={this.setRuntimeName}
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