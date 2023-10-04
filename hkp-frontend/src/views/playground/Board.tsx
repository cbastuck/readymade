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
  InputRoute,
  InputRoutingCompat,
  OutputRoute,
  OutputRouting,
  PeerInputActivation,
  PeerJsHostDescriptor,
  PeerOutputActivation,
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
  inputRouting: InputRoutingCompat;
  outputRouting: OutputRouting;
  boardContext: BoardContextState;
  sidechainRouting: SidechainRouting;
  boardName: string;
  allowedServices: Array<ServiceURI>;
  description: string;

  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: OutputRoute | null
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: InputRoute | null
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

  updateInputActivation = (inputRouting: InputRoutingCompat) => {
    const peerInputActivation = inputRouting
      ? Object.keys(inputRouting).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeInputRouting =
            typeof inputRouting[runtimeId] === "string" // compatibility - was a string with peername
              ? { peer: inputRouting[runtimeId] }
              : (inputRouting[runtimeId] as InputRoute);

          return {
            ...all,
            [activationId]:
              runtimeInputRouting === null
                ? null
                : {
                    ...defaultDiscoveryPeer,
                    ...runtimeInputRouting,
                  },
          };
        }, {})
      : {};

    this.setState((state) => ({ ...state, peerInputActivation }));
  };

  updateOutputActivation = (outputRouting: OutputRouting) => {
    const peerOutputActivation = outputRouting
      ? Object.keys(outputRouting).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeOutputRouting = outputRouting[runtimeId];
          return {
            ...all,
            [activationId]:
              runtimeOutputRouting === null
                ? null
                : {
                    ...defaultDiscoveryPeer,
                    ...runtimeOutputRouting,
                  },
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
    const flow = (runtimeOutput && runtimeOutput.flow) || "pass";
    if (flow === "pass") {
      const nextRuntime = this.getNextRuntime(runtime);
      if (nextRuntime) {
        nextRuntime.processRuntime(result, null);
      }
    }

    if (runtimeOutput.peer && this.peerContext) {
      this.peerContext.sendData(
        `${boardName}-${runtime.name}`,
        runtimeOutput.peer,
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
    const { sidechainRouting, outputRouting } = this.props;
    const runtimeSidechainRouting =
      sidechainRouting && sidechainRouting[runtime.id];

    const runtimeActivation = this.getRuntimeActivation(runtime);
    return (
      <OutputOptions
        items={peers}
        value={this.state.peerOutputActivation[activationId]?.peer || null}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
        onSelect={(peer) => {
          const output = this.state.peerOutputActivation[activationId];
          if (output && output.peer) {
            const srcPeer = this.getPeerName(runtime);
            const dstPeer = output.peer;
            peersContext?.closeConnection(srcPeer, dstPeer);
          }
          this.props.onChangeOutputRouting(runtime, {
            ...output,
            peer,
          });
        }}
        onAction={(action) => {
          switch (action.type) {
            case OutputOptions.updatePeersAction: {
              peersContext?.updatePeers();
              break;
            }
            case OutputOptions.flowChanged:
              this.props.onChangeOutputRouting(runtime, { flow: action.flow });
              return;
            default:
              break;
          }
        }}
        flow={outputRouting[runtime.id]?.flow}
        boardContext={boardContext}
        sidechainRouting={runtimeSidechainRouting}
        onSidechangeRouting={(routes) =>
          this.props.onChangeSidechainRouting(runtime, routes)
        }
        disabled={!runtimeActivation}
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
    const runtimeActivation = this.getRuntimeActivation(runtime);
    return (
      <InputOptions
        ref={(selector) => (this.inputSelectors[runtime.id] = selector)}
        items={peers}
        value={this.state.peerInputActivation[activationId]?.peer || null}
        onAction={(action) => {
          switch (action.type) {
            case InputOptions.updatePeersAction:
              return peersContext?.updatePeers();
            default:
              break;
          }
        }}
        onSelect={(value) => {
          const input = this.state.peerInputActivation[activationId];
          this.props.onChangeInputRouting(
            runtime,
            value
              ? {
                  ...input,
                  peer: value,
                }
              : null
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
    const runtimeActivation = this.getRuntimeActivation(runtime);
    if (!!runtimeActivation) {
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

    const selectedDiscoveryServer = runtimeActivation || defaultDiscoveryPeer;
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
              this.props.onChangeOutputRouting(
                runtime,
                availableDiscoveryPeerHosts[index]
              );
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
              ? this.props.onChangeOutputRouting(
                  runtime,
                  selectedDiscoveryServer
                )
              : this.props.onChangeInputRouting(
                  runtime,
                  selectedDiscoveryServer
                )
          }
        >
          Click to enable
        </div>
      </div>
    );
  };

  renderPeersDeactivator = (runtime: RuntimeDescriptor) => {
    const runtimeActivation = this.getRuntimeActivation(runtime);
    if (!runtimeActivation) {
      return null;
    }
    return (
      <div
        style={{ cursor: "pointer", color: "#1e70bf" }}
        onClick={() => {
          this.props.onChangeInputRouting(runtime, null);
          this.props.onChangeOutputRouting(runtime, null);
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

  getRuntimeActivation = (runtime: RuntimeDescriptor) => {
    const activationId = getActivationId(runtime.id);
    return (
      this.state.peerInputActivation[activationId] ||
      this.state.peerOutputActivation[activationId]
    );
  };

  render() {
    const { description, boardName, allowedServices } = this.props;
    return (
      <div>
        <div style={s(t.w100)}>
          <PeersProvider ref={(ctx) => (this.peerContext = ctx)}>
            <PeersConsumer>
              {(peersContext) =>
                this.props.boardContext.runtimes.map((runtime) => {
                  const runtimeActivation = this.getRuntimeActivation(runtime);
                  const peerName = this.getPeerName(runtime);
                  const activationId = getActivationId(runtime.id);
                  return (
                    <Peer
                      key={`${boardName}-runtime-peer-${runtime.id}`}
                      name={peerName}
                      onData={(envelope) => {
                        const { sender, data } = envelope;
                        const input =
                          this.state.peerInputActivation[activationId];
                        const isWildcardInput =
                          input?.peer === InputOptions.allInputsWildcard;
                        if (isWildcardInput || input?.peer === sender) {
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

                          const isCompatRoute =
                            typeof closedInputRouting === "string";
                          if (
                            !isCompatRoute &&
                            closedInputRouting?.peer !==
                              InputOptions.allInputsWildcard
                          ) {
                            this.props.onChangeInputRouting(runtime, null);
                          }

                          reconnectCallback = // no reconnect for wildcard inputs
                            !isCompatRoute &&
                            closedInputRouting?.peer ===
                              InputOptions.allInputsWildcard
                              ? null
                              : (onClose: () => void) => {
                                  this.props.onChangeInputRouting(
                                    runtime,
                                    isCompatRoute
                                      ? { peer: closedInputRouting }
                                      : closedInputRouting
                                  );
                                  onClose();
                                };
                        } else {
                          const closedOutputRouting =
                            this.props.outputRouting[runtime.id]?.peer;
                          this.props.onChangeOutputRouting(runtime, {
                            peer: null,
                          });
                          reconnectCallback = closedOutputRouting
                            ? (onClose: () => void) => {
                                this.props.onChangeOutputRouting(runtime, {
                                  peer: closedOutputRouting,
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
                      active={!!runtimeActivation}
                      peerHost={runtimeActivation && runtimeActivation.host}
                      usePeerPort={runtimeActivation && runtimeActivation.port}
                      usePeerRoutePath={
                        runtimeActivation && runtimeActivation.path
                      }
                      isSecure={runtimeActivation && runtimeActivation.secure}
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
