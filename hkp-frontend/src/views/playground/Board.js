import React, { Component } from "react";
import { Icon } from "semantic-ui-react";

import PeersProvider, { PeersConsumer } from "../../PeersContext";
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

const usePeerOverHTTPS = window.location.protocol === "https:";

const availablePeers = [
  {
    host: "peers.hookup.to",
    port: usePeerOverHTTPS ? 443 : 80,
    path: "/",
    protocol: usePeerOverHTTPS ? "wss" : "ws",
  },
  {
    host: `peers.${window.location.hostname}`,
    port: usePeerOverHTTPS ? 443 : 80,
    path: "/",
    protocol: usePeerOverHTTPS ? "wss" : "ws",
  },
];

export default class Board extends Component {
  state = {
    peerActivation: {},
    selectedDiscoveryServer: availablePeers[1], // TODO: should be 0
  };
  runtimeInstances = {};
  inputSelectors = {};

  componentDidMount() {
    this.updatePeerActivation(
      this.props.inputRouting,
      this.props.outputRouting
    );
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.inputRouting !== this.props.inputRouting ||
      prevProps.outputRouting !== this.props.outputRouting
    ) {
      this.updatePeerActivation(
        this.props.inputRouting,
        this.props.outputRouting
      );
    }
  }

  updatePeerActivation = (inputRouting, outputRouting) => {
    const inputActivationIds = inputRouting
      ? Object.keys(inputRouting).reduce(
          (a, c) => ({
            ...a,
            [getActivationId(c)]: true,
          }),
          {}
        )
      : {};

    const outputActivationIds = outputRouting
      ? Object.keys(outputRouting).reduce(
          (a, c) => ({
            ...a,
            [getActivationId(c)]: true,
          }),
          {}
        )
      : {};

    this.setState({
      peerActivation: {
        ...inputActivationIds,
        ...outputActivationIds,
      },
    });
  };

  getNextRuntime = (runtime) => {
    const { runtimes = [] } = this.props.boardContext;
    const pos = runtimes.findIndex((rt) => rt.id === runtime.id);
    const nextRuntime = pos !== -1 && runtimes[pos + 1];
    return nextRuntime && this.runtimeInstances[nextRuntime.id];
  };

  getRuntimeById = (runtimeId) => {
    const { runtimes = [] } = this.props.boardContext;
    const runtime = runtimes.find((rt) => rt.id === runtimeId);
    if (!runtime) {
      console.error("Unknown runtime", runtimeId, runtimes);
      return;
    }
    return this.runtimeInstances[runtime.id];
  };

  onResult = async (runtime, svcUuid, result) => {
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
  };

  renderOutputs = (peers, runtime, peersContext, boardContext) => {
    const { peerActivation } = this.state;
    const activationId = getActivationId(runtime.id);
    const isPeerActive = activationId && !!peerActivation[activationId];

    const outputRouting = this.props.outputRouting[runtime.id] || {};
    const { sidechainRouting } = this.props;
    const runtimeSidechainRouting =
      sidechainRouting && sidechainRouting[runtime.id];
    return (
      <OutputOptions
        items={peers}
        value={outputRouting.peer}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
        onSelect={(peer) => {
          if (outputRouting.peer) {
            const srcPeer = this.getPeerName(runtime);
            const dstPeer = outputRouting.peer;
            peersContext.closeConnection(srcPeer, dstPeer);
          }

          this.props.onChangeOutputRouting(runtime, { peer });
        }}
        onAction={(action) => {
          switch (action.type) {
            case OutputOptions.updatePeersAction: {
              peersContext.updatePeers();
              break;
            }
            case OutputOptions.flowChanged:
              this.props.onChangeOutputRouting(runtime, { flow: action.flow });
              return;
            default:
              break;
          }
        }}
        flow={outputRouting.flow}
        boardContext={boardContext}
        sidechainRouting={runtimeSidechainRouting}
        onSidechangeRouting={(routing) =>
          this.props.onChangeSidechainRouting(runtime, routing)
        }
        disabled={!isPeerActive}
      >
        {!isPeerActive && this.renderPeersActivator(activationId)}
        {isPeerActive && this.renderPeersDeactivator(activationId)}
      </OutputOptions>
    );
  };

  renderInputs = (peers, runtime, peersContext) => {
    const { peerActivation } = this.state;
    const activationId = getActivationId(runtime.id);
    const isPeerActive = activationId && !!peerActivation[activationId];

    const inputRouting =
      this.props.inputRouting && this.props.inputRouting[runtime.id];
    return (
      <InputOptions
        ref={(selector) => (this.inputSelectors[runtime.id] = selector)}
        items={peers}
        value={inputRouting}
        onAction={(action) => {
          switch (action.type) {
            case InputOptions.updatePeersAction:
              return peersContext.updatePeers();
            default:
              break;
          }
        }}
        onSelect={(value) => this.props.onChangeInputRouting(runtime, value)}
        disabled={!isPeerActive}
      >
        {!isPeerActive && this.renderPeersActivator(activationId)}
        {isPeerActive && this.renderPeersDeactivator(activationId)}
      </InputOptions>
    );
  };

  renderPeersActivator = (activationId) => {
    const { peerActivation, selectedDiscoveryServer } = this.state;
    const discoveryOptions = availablePeers.reduce((acc, availablePeer) => {
      const hostAndPort = formatHostAndPort(availablePeer);
      return {
        ...acc,
        [hostAndPort]: hostAndPort,
      };
    }, {});

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
          value={formatHostAndPort(selectedDiscoveryServer)}
          options={discoveryOptions}
          onChange={(_ev, { _, index }) =>
            this.setState({ selectedDiscoveryServer: availablePeers[index] })
          }
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
            this.setState({
              peerActivation: {
                ...peerActivation,
                [activationId]: true,
              },
            })
          }
        >
          Click to enable
        </div>
      </div>
    );
  };

  renderPeersDeactivator = (activationId) => {
    return (
      <div
        style={{ cursor: "pointer", color: "#1e70bf" }}
        onClick={() =>
          this.setState({
            peerActivation: {
              ...this.state.peerActivation,
              [activationId]: false,
            },
          })
        }
      >
        Click to disable
      </div>
    );
  };

  renderRuntime = (boardContext, runtime, peersContext, allowedServices) => {
    const { boardName } = this.props;
    const ownPeers = boardContext.runtimes.map(
      (rt) => `${boardName}-${rt.name}`
    );
    const filteredPeers = peersContext.peerNames.filter(
      (x) => ownPeers.indexOf(x) === -1
    );
    return (
      <DragProvider style={{ marginBottom: 5, marginTop: 5 }}>
        <Runtime
          key={`sandbox-playground-${runtime.id}`}
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
          expanded={!runtime.params || !runtime.params.minimized}
          inputs={this.renderInputs(filteredPeers, runtime, peersContext)}
        />
      </DragProvider>
    );
  };

  getPeerName = (runtime) => `${this.props.boardName}-${runtime.name}`;

  render() {
    const { description, boardName, allowedServices } = this.props;
    const { peerActivation, selectedDiscoveryServer } = this.state;
    const {
      host: peerHost,
      port: usePeerPort,
      path: usePeerRoutePath,
    } = selectedDiscoveryServer;
    return (
      <div>
        <div style={s(t.w100)}>
          <PeersProvider ref={(ctx) => (this.peerContext = ctx)}>
            <PeersConsumer>
              {(peersContext) =>
                this.props.boardContext.runtimes.map((runtime) => {
                  const isPeerActive =
                    !!peerActivation[getActivationId(runtime.id)];
                  const peerName = this.getPeerName(runtime);
                  return (
                    <Peer
                      key={`${boardName}-runtime-peer-${runtime.id}`}
                      name={peerName}
                      onData={(envelope) => {
                        const { sender, data } = envelope;
                        const input = this.props.inputRouting[runtime.id];
                        if (
                          input === InputOptions.allInputsWildcard ||
                          input === sender
                        ) {
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
                      onConnectionClosed={(closedPeer) => {
                        // the connection between peers was closed by either side
                        const isInputConnection = closedPeer === peerName;

                        let reconnectCallback;
                        if (isInputConnection) {
                          const closedInputRouting =
                            this.props.inputRouting[runtime.id];

                          if (
                            closedInputRouting !==
                            InputOptions.allInputsWildcard
                          ) {
                            this.props.onChangeInputRouting(runtime, null);
                          }

                          reconnectCallback = (onClose) => {
                            this.props.onChangeInputRouting(
                              runtime,
                              closedInputRouting
                            );
                            onClose();
                          };
                        } else {
                          const closedOutputRouting =
                            this.props.outputRouting[runtime.id].peer;
                          this.props.onChangeOutputRouting(runtime, {
                            peer: null,
                          });
                          reconnectCallback = (onClose) => {
                            this.props.onChangeOutputRouting(runtime, {
                              peer: closedOutputRouting,
                            });
                            onClose();
                          };
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
                        });
                      }}
                      active={isPeerActive}
                      peerHost={peerHost}
                      usePeerPort={usePeerPort}
                      usePeerRoutePath={usePeerRoutePath}
                      usePeerOverHTTPS={usePeerOverHTTPS}
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

function formatHostAndPort(availablePeer) {
  const { host, port, protocol } = availablePeer;
  return `${protocol}://${host}:${port}`;
}
