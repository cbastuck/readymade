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
  ServiceURI,
  SidechainRoute,
  SidechainRouting,
} from "../../types";
import { BoardContextState } from "../../BoardContext";
import { AppContextState } from "../../AppContext";

const defaultDiscoveryPeer: PeerJsHostDescriptor =
  availableDiscoveryPeerHosts[0];

type Props = {
  appContext: AppContextState;
  inputRouting: { [runtimeId: string]: PeerInputActivation };
  outputRouting: { [runtimeId: string]: PeerOutputActivation };
  boardContext: BoardContextState;
  sidechainRouting: SidechainRouting;
  boardName: string;
  allowedServices: Array<ServiceURI>;
  description: string;

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

  peerContext: PeersProvider | null = null;

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

  updateInputActivation = (inputRouting: PeerInputRouting) => {
    const peerInputActivation = inputRouting
      ? Object.keys(inputRouting).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeInputRouting = inputRouting[runtimeId];
          return {
            ...all,
            [activationId]:
              runtimeInputRouting?.route?.peer &&
              !runtimeInputRouting.hostDescriptor
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

  getNextRuntime = (runtime: RuntimeDescriptor) => {
    const { runtimes = [] } = this.props.boardContext;
    const pos = runtimes.findIndex((rt) => rt.id === runtime.id);
    const nextRuntime = pos !== -1 && runtimes[pos + 1];
    return nextRuntime && this.runtimeInstances[nextRuntime.id];
  };

  getRuntimeById = (runtimeId: string) => {
    const { runtimes = [] } = this.props.boardContext;
    const runtime = runtimes.find((rt) => rt.id === runtimeId);
    if (!runtime) {
      console.error("Unknown runtime", runtimeId, runtimes);
      return;
    }
    return this.runtimeInstances[runtime.id];
  };

  onResult = async (
    runtime: RuntimeDescriptor,
    svcUuid: string,
    result: any
  ) => {
    const { sidechainRouting, outputRouting, boardName } = this.props;
    const sroute = sidechainRouting && sidechainRouting[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dst = this.runtimeInstances[route.runtimeId];
        if (dst) {
          await dst.configureService(route.serviceUuid, result);
        } else {
          console.error(
            "Playground.onResult() sidechain destination not found",
            route.runtimeId,
            this.runtimeInstances
          );
        }
      }
    }
    const runtimeOutput = outputRouting[runtime.id] || {};
    const flow = (runtimeOutput && runtimeOutput.route?.flow) || "pass";
    if (flow === "pass") {
      const nextRuntime = this.getNextRuntime(runtime);
      if (nextRuntime) {
        nextRuntime.processRuntime(result, null);
      }
    }

    if (runtimeOutput.route?.peer && this.peerContext) {
      this.peerContext.sendData(
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
        items={peers}
        value={outputActivation?.route?.peer || null}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
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
            case OutputOptions.updatePeersAction: {
              peersContext?.updatePeers();
              break;
            }
            case OutputOptions.flowChanged:
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
        {this.renderPeersDeactivator(runtime)}
      </OutputOptions>
    );
  };

  renderInputs = (
    peers: Array<string>,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null
  ) => {
    const activationId = getActivationId(runtime.id);
    const runtimeActivation = this.state.peerInputActivation[activationId];
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
        disabled={!runtimeActivation}
      >
        {this.renderPeersActivator(runtime, "input")}
        {this.renderPeersDeactivator(runtime)}
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
    const hostDescriptor =
      inputActivation?.hostDescriptor || outputActivation?.hostDescriptor;
    if (!!hostDescriptor) {
      return null; // already active
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
    const outputRoute = outputActivation?.route || {
      peer: null,
      flow: "pass",
    };
    const selectedDiscoveryServer = defaultDiscoveryPeer;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <div style={{ width: 250, paddingBottom: 5 }}>
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
              this.props.onChangeOutputRouting(runtime, {
                route: outputRoute,
                hostDescriptor: availableDiscoveryPeerHosts[index],
              });
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
          onClick={() =>
            type === "output"
              ? this.props.onChangeOutputRouting(runtime, {
                  route: outputRoute,
                  hostDescriptor: selectedDiscoveryServer,
                })
              : this.props.onChangeInputRouting(runtime, {
                  route: { peer: null },
                  hostDescriptor: selectedDiscoveryServer,
                })
          }
        >
          Click to enable
        </div>
      </div>
    );
  };

  renderPeersDeactivator = (runtime: RuntimeDescriptor) => {
    const activationId = getActivationId(runtime.id);
    const inputRoute = this.state.peerInputActivation[activationId];
    const outputRoute = this.state.peerOutputActivation[activationId];
    const hostDescriptor =
      inputRoute?.hostDescriptor || outputRoute?.hostDescriptor;
    if (!hostDescriptor) {
      return null; // already active
    }
    return (
      <div
        style={{ cursor: "pointer", color: "#1e70bf" }}
        onClick={() => {
          inputRoute &&
            this.props.onChangeInputRouting(runtime, {
              ...inputRoute,
              hostDescriptor: null,
            });
          outputRoute &&
            this.props.onChangeOutputRouting(runtime, {
              ...outputRoute,
              hostDescriptor: null,
            });
        }}
      >
        Click to disable
      </div>
    );
  };

  renderRuntime = (
    boardContext: BoardContextState,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    allowedServices: Array<string>
  ) => {
    const { boardName } = this.props;
    const ownPeers = boardContext.runtimes.map(
      (rt) => `${boardName}-${rt.name}`
    );
    const filteredPeers =
      peersContext?.peerNames.filter((x) => ownPeers.indexOf(x) === -1) || [];

    return (
      <DragProvider style={{ marginBottom: 5, marginTop: 5 }}>
        <Runtime
          key={`sandbox-playground-${runtime.id}`}
          initialState={runtime.state}
          ref={(rt) => (this.runtimeInstances[runtime.id] = rt)}
          boardContext={boardContext}
          runtime={runtime}
          onResult={this.onResult.bind(this, runtime)}
          allowedServices={allowedServices}
          outputs={this.renderOutputs(
            filteredPeers,
            runtime,
            peersContext,
            boardContext
          )}
          // expanded={!runtime.params || !runtime.params.minimized}
          inputs={this.renderInputs(filteredPeers, runtime, peersContext)}
        />
      </DragProvider>
    );
  };

  getPeerName = (runtime: RuntimeDescriptor) =>
    `${this.props.boardName}-${runtime.name}`;

  render() {
    const { description, boardName, allowedServices } = this.props;
    return (
      <div>
        <div style={s(t.w100)}>
          <PeersProvider ref={(ctx) => (this.peerContext = ctx)}>
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
                            rt.processRuntime(data, null);
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
                        this.props.appContext.pushNotification({
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
                        peersContext,
                        allowedServices
                      )}
                    </Peer>
                  );
                })
              }
            </PeersConsumer>
          </PeersProvider>
        </div>
        <Description description={description} boardName={boardName} />
        <VSpacer />
      </div>
    );
  }
}

function formatHostAndPort(availablePeer: PeerJsHostDescriptor) {
  const { host, port, secure } = availablePeer;
  const protocol = secure ? "wss" : "ws";
  return `${protocol}://${host}:${port}`;
}
