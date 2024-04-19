import { Component } from "react";
import { Icon } from "semantic-ui-react";

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
import SelectorField from "../../components/shared/SelectorField";
import { availableDiscoveryPeerHosts } from "./common";
import {
  PeerInputActivation,
  PeerInputRouting,
  PeerJsHostDescriptor,
  PeerOutputActivation,
  PeerOutputRouting,
  RuntimeDescriptor,
  SidechainRoute,
  SidechainRouting,
} from "../../types";
import { BoardContextState } from "../../BoardContext";

const defaultDiscoveryPeer: PeerJsHostDescriptor =
  availableDiscoveryPeerHosts[0];

type Props = {
  inputRouting: { [runtimeId: string]: PeerInputActivation };
  outputRouting: { [runtimeId: string]: PeerOutputActivation };
  boardContext: BoardContextState;
  sidechainRouting: SidechainRouting;
  boardName: string;
  description?: string;
  headless?: boolean;
  onResult?: (result: any) => void;

  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: PeerOutputActivation
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: PeerInputActivation
  ) => void;
  onChangeSidechainRouting: (
    runtime: RuntimeDescriptor,
    routing: Array<SidechainRoute>
  ) => void;
};

type State = {
  peerOutputActivation: {
    [getActivationId: string]: PeerOutputActivation | null;
  };
  peerInputActivation: { [getActivationId: string]: PeerInputActivation };
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
      console.log(
        "componentDidUpdate - new input routing",
        this.props.inputRouting
      );
      this.updateInputActivation(this.props.inputRouting);
    }

    if (prevProps.outputRouting !== this.props.outputRouting) {
      this.updateOutputActivation(this.props.outputRouting);
    }
  }

  updateInputActivation = (inputRouting: PeerInputRouting) => {
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

  updateOutputActivation = (outputRouting: PeerOutputRouting) => {
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

  pendingResultCallback: null | ((p: any) => void) = null;
  onResult = async (
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    _svcUuid: string | null,
    result: any,
    _requestId: string | null,
    resultCallback: null | ((p: any) => void)
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

    if (resultCallback) {
      this.pendingResultCallback = resultCallback;
    }

    const runtimeOutput = outputRouting[runtime.id] || {};
    const flow = (runtimeOutput && runtimeOutput.route?.flow) || "pass";
    if (flow === "pass") {
      const nextRuntime = this.getNextRuntime(runtime);
      const nextScope =
        nextRuntime && this.props.boardContext.scopes[nextRuntime.id];
      const nextApi =
        nextScope && this.props.boardContext.runtimeApis[nextRuntime.type];
      if (nextApi) {
        nextApi.processRuntime(nextScope, result, null);
      } else {
        if (this.pendingResultCallback) {
          this.pendingResultCallback(result);
          this.pendingResultCallback = null;
        }
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
    const inputActivation = this.state.peerInputActivation[activationId];
    const hostDescriptor =
      outputActivation?.hostDescriptor || inputActivation?.hostDescriptor;
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
            outputActivation &&
              this.props.onChangeOutputRouting(runtime, {
                ...outputActivation,
                route: {
                  ...outputActivation.route,
                  peer,
                },
              });
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
                        route: {
                          ...outputActivation.route,
                          flow: action.flow,
                        },
                      }
                    : {
                        hostDescriptor: null,
                        route: { flow: action.flow, peer: null },
                      }
                );
              }
              return;
            default:
              break;
          }
        }}
        flow={outputActivation?.route?.flow}
        boardContext={boardContext}
        sidechainRouting={runtimeSidechainRouting}
        onSidechangeRouting={(routes) =>
          this.props.onChangeSidechainRouting(runtime, routes)
        }
        disabled={!hostDescriptor}
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
          width: 250,
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
          onChange={(_ev, { index }) => {
            if (index !== undefined) {
              if (type === "output") {
                const outputRoute = outputActivation?.route || {
                  peer: null,
                  flow: "pass",
                };
                this.props.onChangeOutputRouting(runtime, {
                  route: outputRoute,
                  hostDescriptor: availableDiscoveryPeerHosts[index],
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
        <div
          style={{
            marginTop: "3px",
            color: "#4183c4",
            cursor: "pointer",
            textAlign: "center",
          }}
          onClick={() => {
            if (type === "output") {
              const outputRoute = outputActivation?.route || {
                peer: null,
                flow: "pass",
              };
              this.props.onChangeOutputRouting(runtime, {
                route: outputRoute,
                hostDescriptor: selectedDiscoveryServer,
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
        </div>
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
    if (
      type === "input" &&
      (!inputRoute || inputRoute.hostDescriptor === null)
    ) {
      return null;
    }
    if (
      type === "output" &&
      (!outputRoute || outputRoute.hostDescriptor === null)
    ) {
      return null;
    }
    return (
      <div
        style={{ cursor: "pointer", color: "#1e70bf" }}
        onClick={() => {
          if (type === "input") {
            console.log("SETTOJNG", {
              ...(inputRoute || {}),
              hostDescriptor: null,
            });
            this.props.onChangeInputRouting(runtime, {
              ...(inputRoute || {}),
              hostDescriptor: null,
            });
          } else {
            if (outputRoute) {
              this.props.onChangeOutputRouting(runtime, {
                ...(outputRoute || {}),
                hostDescriptor: null,
              });
            }
          }
        }}
      >
        Click to disable
      </div>
    );
  };

  renderRuntime = (
    boardContext: BoardContextState,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null
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
      requestId: string | null,
      resultCallback: null | ((p: any) => void)
    ) =>
      this.onResult(
        runtime,
        peersContext,
        uuid,
        result,
        requestId,
        resultCallback
      );
    const outputs =
      runtime.type === "browser"
        ? this.renderOutputs(filteredPeers, runtime, peersContext, boardContext)
        : undefined;
    const inputs =
      runtime.type === "browser"
        ? this.renderInputs(filteredPeers, runtime, peersContext)
        : undefined;
    return (
      <DragProvider style={{ marginBottom: 5, marginTop: 5 }}>
        <Runtime
          key={`board-${runtime.id}`}
          initialState={runtime.state}
          ref={(rt) => (this.runtimeInstances[runtime.id] = rt)}
          boardContext={boardContext}
          runtime={runtime}
          onResult={onResult}
          outputs={outputs}
          inputs={inputs}
          headless={this.props.headless}
        />
      </DragProvider>
    );
  };

  getPeerName = (runtime: RuntimeDescriptor) =>
    `${this.props.boardName}-${runtime.name}`;

  render() {
    const { description, boardName } = this.props;
    return (
      <div>
        <div style={s(t.w100)}>
          <PeersProvider>
            <PeersConsumer>
              {(peersContext) =>
                this.props.boardContext.runtimes.map((runtime) => {
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
                              : (onClose: () => void) => {
                                  this.props.onChangeInputRouting(runtime, {
                                    ...inputActivation,
                                    ...closedInputRouting,
                                  });
                                  onClose();
                                };
                        } else {
                          const closedOutputRouting =
                            this.props.outputRouting[runtime.id]?.route?.peer;
                          this.props.onChangeOutputRouting(runtime, {
                            hostDescriptor:
                              outputActivation?.hostDescriptor || null,
                            route: {
                              ...(outputActivation?.route || {
                                flow: "pass",
                                peer: null,
                              }),
                              peer: null,
                            },
                          });
                          reconnectCallback = closedOutputRouting
                            ? (onClose: () => void) => {
                                this.props.onChangeOutputRouting(runtime, {
                                  hostDescriptor: hostDescriptor || null,
                                  route: {
                                    flow:
                                      outputActivation?.route.flow || "pass",
                                    peer: closedOutputRouting,
                                  },
                                });
                                onClose();
                              }
                            : null;
                        }
                        this.props.boardContext.appContext?.pushNotification({
                          type: "info",
                          message: `Connection in runtime "${runtime.name}" to peer "${closedPeer}" was closed`,
                          ctas: [
                            {
                              icon: <Icon name="redo" />,
                              positive: true,
                              callback: reconnectCallback,
                            },
                          ],
                          tag: "peers",
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
                        peersContext
                      )}
                    </Peer>
                  );
                })
              }
            </PeersConsumer>
          </PeersProvider>
        </div>
        {description && (
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
