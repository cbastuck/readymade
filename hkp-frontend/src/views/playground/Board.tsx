import { Component } from "react";

import PeersProvider, {
  PeersConsumer,
  PeersContextState,
} from "../../PeersContext";
import Peer from "../../components/Peer";
import { s, t } from "../../styles";
import Description from "./Description";
import VSpacer from "../../components/shared/VSpacer";
import Runtime from "../../components/Runtime";
import DragProvider from "../../DragContext";
import OutputOptions from "../../components/shared/OutputOptions";
import InputOptions from "../../components/shared/InputOptions";
import { getActivationId } from "./common";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { availableDiscoveryPeerHosts } from "./common";
import {
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  PeerJsHostDescriptor,
  RuntimeDescriptor,
  RuntimeInputOptions,
  RuntimeOutputOptions,
  SidechainRoute,
  SidechainRouting,
  ProcessContext,
} from "../../types";
import { BoardContextState } from "../../BoardContext";
import Button from "hkp-frontend/src/ui-components/Button";
import RuntimeWithDropBars from "./RuntimeWithDropBars";

const defaultDiscoveryPeer: PeerJsHostDescriptor =
  availableDiscoveryPeerHosts[0];

type Props = {
  inputRouting: RuntimeInputRoutings;
  outputRouting: RuntimeOutputRoutings;
  boardContext: BoardContextState;
  sidechainRouting: SidechainRouting;
  boardName: string;
  description?: string;
  headless?: boolean;
  onResult?: (result: any) => void;

  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeOutputOptions
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeInputOptions
  ) => void;
  onChangeSidechainRouting: (
    runtime: RuntimeDescriptor,
    routing: Array<SidechainRoute>
  ) => void;
};

type State = {
  peerOutputActivation: RuntimeOutputRoutings;
  peerInputActivation: RuntimeInputRoutings;
};

export default class Board extends Component<Props, State> {
  state: State = {
    peerOutputActivation: {},
    peerInputActivation: {},
  };
  runtimeInstances: { [runtimeId: string]: Runtime | null } = {};
  inputSelectors: { [runtimeId: string]: InputOptions | null } = {};

  componentDidMount() {
    this.updateInputActivation(this.props.inputRouting);
    this.updateOutputActivation(this.props.outputRouting);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.inputRouting !== this.props.inputRouting) {
      this.updateInputActivation(this.props.inputRouting);
    }

    if (prevProps.outputRouting !== this.props.outputRouting) {
      this.updateOutputActivation(this.props.outputRouting);
    }
  }

  updateInputActivation = (inputRouting: RuntimeInputRoutings) => {
    const peerInputActivation = inputRouting
      ? Object.keys(inputRouting).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeInputRouting = inputRouting[runtimeId];
          return {
            ...all,
            [activationId]:
              runtimeInputRouting?.route?.peer &&
              !runtimeInputRouting.hostDescriptor &&
              runtimeInputRouting.hostDescriptor !== null
                ? {
                    ...runtimeInputRouting,
                    hostDescriptor: defaultDiscoveryPeer,
                  }
                : runtimeInputRouting,
          };
        }, {})
      : {};

    this.setState((state) => ({ ...state, peerInputActivation }));
  };

  updateOutputActivation = (outputRouting: RuntimeOutputRoutings) => {
    const peerOutputActivation = outputRouting
      ? Object.keys(outputRouting).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeOutputRouting = outputRouting[runtimeId];
          return {
            ...all,
            [activationId]:
              runtimeOutputRouting?.route?.peer &&
              !runtimeOutputRouting.hostDescriptor
                ? {
                    ...runtimeOutputRouting,
                    hostDescriptor: defaultDiscoveryPeer,
                  }
                : runtimeOutputRouting,
          };
        }, {})
      : {};

    this.setState((state) => ({ ...state, peerOutputActivation }));
  };

  getNextRuntime = (runtime: RuntimeDescriptor): RuntimeDescriptor | null => {
    const { runtimes = [] } = this.props.boardContext;
    const pos = runtimes.findIndex((rt) => rt.id === runtime.id);
    return pos !== -1 ? runtimes[pos + 1] : null;
  };

  getRuntimeById = (runtimeId: string): RuntimeDescriptor | null => {
    const { runtimes = [] } = this.props.boardContext;
    const runtime = runtimes.find((rt) => rt.id === runtimeId);
    if (!runtime) {
      console.error("Unknown runtime", runtimeId, runtimes);
    }
    return runtime || null;
  };

  // Board callbacks
  pendingBoardCallbacks: { [reqId: string]: (result: any) => void } = {};

  registerPendingBoardCallback = (context?: ProcessContext | null) => {
    if (context?.onResolve) {
      this.pendingBoardCallbacks[context.requestId] = context.onResolve;
    }
  };

  processPendingBoardCallbacks = (
    context: ProcessContext | null | undefined,
    result: any
  ) => {
    const callback = context && this.pendingBoardCallbacks[context.requestId];
    if (callback) {
      callback(result);
      delete this.pendingBoardCallbacks[context.requestId];
    }
  };

  onResult = async (
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    _svcUuid: string | null,
    result: any,
    context?: ProcessContext | null
  ) => {
    const { sidechainRouting, outputRouting, boardName } = this.props;
    const sroute = sidechainRouting && sidechainRouting[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dstRuntime = this.props.boardContext.runtimes.find(
          (rt) => rt.id === route.runtimeId
        );
        const dstScope =
          dstRuntime && this.props.boardContext.scopes[dstRuntime.id];
        const api =
          dstScope && this.props.boardContext.runtimeApis[dstRuntime.type];
        if (dstScope && api) {
          const config =
            typeof result === "string" ? JSON.parse(result) : result;
          await api.configureService(
            dstScope,
            { uuid: route.serviceUuid },
            config
          );
        } else {
          console.error(
            "Board.onResult() sidechain destination not found",
            route.runtimeId,
            this.props.boardContext.scopes,
            dstScope,
            api
          );
        }
      }
    }

    this.registerPendingBoardCallback(context);

    const runtimeOutput = outputRouting[runtime.id] || {};
    const flow = runtimeOutput?.flow || "pass";
    if (flow === "pass") {
      const nextRuntime = this.getNextRuntime(runtime);
      const nextScope =
        nextRuntime && this.props.boardContext.scopes[nextRuntime.id];
      const nextApi =
        nextScope && this.props.boardContext.runtimeApis[nextRuntime.type];
      if (nextApi && result !== null) {
        nextApi.processRuntime(nextScope, result, null, context);
      } else {
        this.processPendingBoardCallbacks(context, result);
        if (this.props.onResult) {
          if (result !== null) {
            // null means stop the process
            this.props.onResult(result);
          }
        }
      }
    }

    if (runtimeOutput.route?.peer && peersContext) {
      peersContext.sendData(
        `${boardName}-${runtime.name}`,
        runtimeOutput.route.peer,
        result
      );
    }
  };

  renderOutputs = (
    peers: Array<string>,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    boardContext: BoardContextState
  ) => {
    const activationId = getActivationId(runtime.id);
    const { sidechainRouting } = this.props;
    const runtimeSidechainRouting =
      sidechainRouting && sidechainRouting[runtime.id];

    const outputActivation = this.state.peerOutputActivation[activationId];
    return (
      <OutputOptions
        id={runtime.id}
        items={peers}
        value={outputActivation?.route?.peer || null}
        onSelect={(peer: string | null) => {
          if (outputActivation) {
            if (outputActivation?.route?.peer) {
              const srcPeer = this.getPeerName(runtime);
              const dstPeer = outputActivation.route.peer;
              peersContext?.closeConnection(srcPeer, dstPeer);
            }
            if (outputActivation) {
              this.props.onChangeOutputRouting(runtime, {
                ...outputActivation,
                route: {
                  ...outputActivation.route,
                  peer,
                },
              });
            }
          }
        }}
        onAction={(action) => {
          switch (action.type) {
            case "update-peers": {
              peersContext?.updatePeers();
              break;
            }
            case "flow-changed":
              if (action.flow) {
                this.props.onChangeOutputRouting(
                  runtime,
                  outputActivation
                    ? {
                        ...outputActivation,
                        flow: action.flow,
                      }
                    : {
                        hostDescriptor: null,
                        route: { peer: null },
                        flow: action.flow,
                      }
                );
              }
              return;
            default:
              break;
          }
        }}
        flow={outputActivation?.flow}
        boardContext={boardContext}
        sidechainRouting={runtimeSidechainRouting}
        onSidechangeRouting={(routes) =>
          this.props.onChangeSidechainRouting(runtime, routes)
        }
        disabled={!outputActivation?.hostDescriptor}
      >
        {this.renderPeersActivator(runtime, "output")}
        {this.renderPeersDeactivator(runtime, "output")}
      </OutputOptions>
    );
  };

  renderInputs = (
    peers: Array<string>,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputActivation = this.state.peerInputActivation[activationId];
    return (
      <InputOptions
        ref={(selector) => (this.inputSelectors[runtime.id] = selector)}
        items={peers}
        value={
          this.state.peerInputActivation[activationId]?.route?.peer || null
        }
        onAction={(action) => {
          switch (action.type) {
            case InputOptions.updatePeersAction:
              return peersContext?.updatePeers();
            default:
              break;
          }
        }}
        onSelect={(value: string | null) => {
          const input = this.state.peerInputActivation[activationId];
          this.props.onChangeInputRouting(
            runtime,
            value === null
              ? { ...input, route: { peer: null } }
              : {
                  ...input,
                  route: {
                    peer: value,
                  },
                }
          );
        }}
        disabled={!inputActivation || !inputActivation.hostDescriptor}
      >
        {this.renderPeersActivator(runtime, "input")}
        {this.renderPeersDeactivator(runtime, "input")}
      </InputOptions>
    );
  };

  renderPeersActivator = (
    runtime: RuntimeDescriptor,
    type: "input" | "output"
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputActivation = this.state.peerInputActivation[activationId];
    const outputActivation = this.state.peerOutputActivation[activationId];
    if (type === "input" && inputActivation?.hostDescriptor) {
      return null;
    }
    if (type === "output" && outputActivation?.hostDescriptor) {
      return null;
    }

    const discoveryOptions = availableDiscoveryPeerHosts.reduce(
      (acc, availablePeer) => {
        const hostAndPort = formatHostAndPort(availablePeer);
        return {
          ...acc,
          [hostAndPort]: hostAndPort,
        };
      },
      {}
    );

    const selectedDiscoveryServer = defaultDiscoveryPeer;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
          width: 300,
        }}
      >
        <div
          className="font-sans-clean text-base tracking-widest leading-2"
          style={{ paddingBottom: 5 }}
        >
          Receive or send data from or to a peer runtime. Activate peer
          discovery via:
        </div>
        <SelectorField
          label="URL"
          value={
            selectedDiscoveryServer
              ? formatHostAndPort(selectedDiscoveryServer)
              : null
          }
          options={discoveryOptions}
          onChange={({ index }) => {
            if (index !== undefined) {
              if (type === "output") {
                const outputRoute = outputActivation?.route || {
                  peer: null,
                };
                this.props.onChangeOutputRouting(runtime, {
                  route: outputRoute,
                  hostDescriptor: availableDiscoveryPeerHosts[index],
                  flow: outputActivation?.flow || "pass",
                });
              } else {
                const inputRoute = inputActivation?.route || {
                  peer: null,
                  flow: "pass",
                };
                this.props.onChangeInputRouting(runtime, {
                  route: inputRoute,
                  hostDescriptor: availableDiscoveryPeerHosts[index],
                });
              }
            }
          }}
          uppercaseValues={false}
        />
        <Button
          className="mr-2 my-2"
          onClick={() => {
            if (type === "output") {
              const outputRoute = outputActivation?.route || {
                peer: null,
              };
              this.props.onChangeOutputRouting(runtime, {
                route: outputRoute,
                hostDescriptor: selectedDiscoveryServer,
                flow: outputActivation?.flow || "pass",
              });
            } else {
              this.props.onChangeInputRouting(runtime, {
                route: { peer: null },
                hostDescriptor: selectedDiscoveryServer,
              });
            }
          }}
        >
          Click to enable
        </Button>
      </div>
    );
  };

  renderPeersDeactivator = (
    runtime: RuntimeDescriptor,
    type: "input" | "output"
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputRoute = this.state.peerInputActivation[activationId];
    const outputRoute = this.state.peerOutputActivation[activationId];
    if (type === "input" && (!inputRoute || !inputRoute.hostDescriptor)) {
      return null;
    }
    if (type === "output" && (!outputRoute || !outputRoute.hostDescriptor)) {
      return null;
    }
    return (
      <div className={type === "input" ? "mr-2 mb-2" : "mx-2 mb-2"}>
        <Button
          className="w-full"
          onClick={() => {
            if (type === "input") {
              this.props.onChangeInputRouting(runtime, {
                ...(inputRoute || {}),
                hostDescriptor: null,
              });
            } else {
              if (outputRoute) {
                this.props.onChangeOutputRouting(runtime, {
                  ...outputRoute,
                  route: { peer: null },
                  hostDescriptor: null,
                });
              }
            }
          }}
        >
          Click to disable
        </Button>
      </div>
    );
  };

  processRuntimeByName = async (name: string, params: any): Promise<any> => {
    const rt = this.props.boardContext.runtimes.find((rt) => rt.name === name);
    if (rt) {
      const scope = this.props.boardContext.scopes[rt.id];
      const api = this.props.boardContext.runtimeApis[rt.type];
      if (scope && api) {
        return api.processRuntime(scope, params, null);
      }
    }
    console.error(
      `Board.processRuntimeByName could not process runtime with name: ${name}`
    );
    return null;
  };

  renderRuntime = (
    boardContext: BoardContextState,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    runtimeIdx: number
  ) => {
    const { boardName } = this.props;
    const ownPeers = boardContext.runtimes.map(
      (rt) => `${boardName}-${rt.name}`
    );
    const filteredPeers =
      peersContext?.peerNames.filter((x) => ownPeers.indexOf(x) === -1) || [];

    const onResult = (
      uuid: string | null,
      result: any,
      context?: ProcessContext | null
    ) => this.onResult(runtime, peersContext, uuid, result, context);
    const outputs =
      runtime.type === "browser"
        ? this.renderOutputs(filteredPeers, runtime, peersContext, boardContext)
        : undefined;
    const inputs =
      runtime.type === "browser"
        ? this.renderInputs(filteredPeers, runtime, peersContext)
        : undefined;

    const onDrop = (runtimeId: string, newIndex: number) => {
      boardContext.arrangeRuntime(runtimeId, newIndex);
    };

    return (
      <DragProvider style={{ marginBottom: 5, marginTop: 5 }}>
        <RuntimeWithDropBars index={runtimeIdx} onDrop={onDrop}>
          <Runtime
            key={`board-${runtime.id}`}
            initialState={runtime.state}
            ref={(rt) => (this.runtimeInstances[runtime.id] = rt)}
            boardContext={boardContext}
            runtime={runtime}
            onResult={onResult}
            processRuntimeByName={this.processRuntimeByName}
            outputs={outputs}
            inputs={inputs}
            headless={this.props.headless}
          />
        </RuntimeWithDropBars>
      </DragProvider>
    );
  };

  getPeerName = (runtime: RuntimeDescriptor) =>
    `${this.props.boardName}-${runtime.name}`;

  render() {
    const { description, boardName } = this.props;
    return (
      <div className="flex flex-col h-full">
        <div style={s(t.w100)}>
          <PeersProvider>
            <PeersConsumer>
              {(peersContext) =>
                this.props.boardContext.runtimes.map((runtime, runtimeIdx) => {
                  const activationId = getActivationId(runtime.id);
                  const inputActivation =
                    this.state.peerInputActivation[activationId];
                  const outputActivation =
                    this.state.peerOutputActivation[activationId];
                  const hostDescriptor =
                    inputActivation?.hostDescriptor ||
                    outputActivation?.hostDescriptor;
                  const peerName = this.getPeerName(runtime);
                  return (
                    <Peer
                      key={`${boardName}-runtime-peer-${runtime.id}`}
                      name={peerName}
                      onData={(envelope) => {
                        const { sender, data } = envelope;
                        const input =
                          this.state.peerInputActivation[activationId];
                        const isWildcardInput =
                          input?.route?.peer === InputOptions.allInputsWildcard;
                        if (isWildcardInput || input?.route?.peer === sender) {
                          const rt = this.getRuntimeById(runtime.id);
                          if (rt) {
                            const scope = this.props.boardContext.scopes[rt.id];
                            const api =
                              this.props.boardContext.runtimeApis[rt.type];
                            if (scope && api) {
                              api.processRuntime(scope, data, null);
                            }
                          }
                        } else {
                          const selector = this.inputSelectors[runtime.id];
                          if (selector) {
                            selector.signalIncoming(sender);
                          }
                        }
                      }}
                      onConnectionClosed={(closedPeer) => {
                        // the connection between peers was closed by either side
                        const isInputConnection = closedPeer === peerName;
                        let reconnectCallback;
                        if (isInputConnection) {
                          const closedInputRouting =
                            this.props.inputRouting[runtime.id];

                          if (
                            closedInputRouting?.route?.peer !==
                            InputOptions.allInputsWildcard
                          ) {
                            this.props.onChangeInputRouting(runtime, {
                              ...inputActivation,
                              route: { peer: null },
                            });
                          }

                          reconnectCallback = // no reconnect for wildcard inputs
                            closedInputRouting?.route?.peer ===
                            InputOptions.allInputsWildcard
                              ? null
                              : () => {
                                  this.props.onChangeInputRouting(runtime, {
                                    ...inputActivation,
                                    ...closedInputRouting,
                                  });
                                };
                        } else {
                          const closedOutputRouting =
                            this.props.outputRouting[runtime.id]?.route?.peer;
                          this.props.onChangeOutputRouting(runtime, {
                            hostDescriptor:
                              outputActivation?.hostDescriptor || null,
                            route: {
                              ...(outputActivation?.route || {
                                peer: null,
                              }),
                              peer: null,
                            },
                            flow: outputActivation?.flow || "pass",
                          });
                          reconnectCallback = closedOutputRouting
                            ? () => {
                                this.props.onChangeOutputRouting(runtime, {
                                  hostDescriptor: hostDescriptor || null,
                                  route: {
                                    peer: closedOutputRouting,
                                  },
                                  flow: outputActivation?.flow || "pass",
                                });
                              }
                            : null;
                        }
                        this.props.boardContext.appContext?.pushNotification({
                          type: "info",
                          message: `Connection in runtime "${runtime.name}" to peer "${closedPeer}" was closed`,
                          action: reconnectCallback
                            ? {
                                label: "redo",
                                callback: reconnectCallback,
                              }
                            : undefined,
                        });
                      }}
                      active={!!hostDescriptor}
                      peerHost={hostDescriptor?.host}
                      usePeerPort={hostDescriptor?.port}
                      usePeerRoutePath={hostDescriptor?.path}
                      isSecure={hostDescriptor?.secure}
                    >
                      {this.renderRuntime(
                        this.props.boardContext,
                        runtime,
                        peersContext,
                        runtimeIdx
                      )}
                    </Peer>
                  );
                })
              }
            </PeersConsumer>
          </PeersProvider>
        </div>
        {description && !this.props.headless && (
          <>
            <Description description={description} boardName={boardName} />
            <VSpacer />
          </>
        )}
      </div>
    );
  }
}

function formatHostAndPort(availablePeer: PeerJsHostDescriptor) {
  const { host, port, secure } = availablePeer;
  const protocol = secure ? "wss" : "ws";
  return `${protocol}://${host}:${port}`;
}
