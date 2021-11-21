import React, { Component } from "react";
import { Button } from "semantic-ui-react";

import PeersProvider, { PeersConsumer } from "../../PeersContext";
import Peer from "../../components/Peer";
import { s, t } from "../../styles";
import SaveBoardPrompt from "../../components/SaveBoardPrompt";
import Description from "./Description";
import VSpacer from "../../components/shared/VSpacer";
import Runtime from "../../components/Runtime";
import DragProvider from "../../DragContext";
import OutputOptions from "../../components/shared/OutputOptions";
import InputOptions from "../../components/shared/InputOptions";
import { getActivationId } from "./common";

export default class Board extends Component {
  state = {
    peerActivation: {},
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

  renderOutputs = (peers, runtime, onUpdatePeers, boardContext) => {
    const { peerActivation } = this.state;
    const outputRouting = this.props.outputRouting[runtime.id] || {};

    const { sidechainRouting } = this.props;
    const runtimeSidechainRouting =
      sidechainRouting && sidechainRouting[runtime.id];
    return (
      <OutputOptions
        items={peers}
        initialValue={outputRouting.peer}
        onExpand={() => {
          const rt = this.getRuntimeById(runtime.id);
          if (rt) {
            rt.scrollRuntimeContainerToRight();
          }
        }}
        onSelect={(peer) => this.props.onChangeOutputRouting(runtime, { peer })}
        onAction={(action) => {
          switch (action.type) {
            case OutputOptions.updatePeersAction: {
              const activationId = getActivationId(runtime.id);
              if (!peerActivation[activationId]) {
                this.setState({
                  peerActivation: {
                    ...peerActivation,
                    [activationId]: true,
                  },
                });
              } else {
                onUpdatePeers();
              }
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
      />
    );
  };

  renderInputs = (peers, runtime, onUpdatePeers) => {
    const { peerActivation } = this.state;
    const activationId = getActivationId(runtime.id);
    const isPeerActive = !!peerActivation[activationId];
    const inputRouting =
      this.props.inputRouting && this.props.inputRouting[runtime.id];
    return (
      <InputOptions
        ref={(selector) => (this.inputSelectors[runtime.id] = selector)}
        items={peers}
        initialValue={inputRouting}
        onAction={(action) => {
          switch (action.type) {
            case InputOptions.updatePeersAction:
              return onUpdatePeers();
            default:
              break;
          }
        }}
        onSelect={(value) => this.props.onChangeInputRouting(runtime, value)}
        disabled={!isPeerActive}
      >
        <div
          style={{
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
          {!isPeerActive ? "Click to enable" : false}
        </div>
      </InputOptions>
    );
  };

  renderRuntime = (boardContext, runtime, peers, allowedServices) => {
    const { sidechainRouting, boardName } = this.props;

    const ownPeers = boardContext.runtimes.map(
      (rt) => `${boardName}-${rt.name}`
    );
    const filteredPeers = peers.peerNames.filter(
      (x) => ownPeers.indexOf(x) === -1
    );
    return (
      <DragProvider style={{ marginBottom: 10, marginTop: 10 }}>
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
            peers.updatePeers,
            boardContext
          )}
          inputs={this.renderInputs(filteredPeers, runtime, peers.updatePeers)}
        />
      </DragProvider>
    );
  };

  render() {
    const {
      boardContext,
      description,
      boardName,
      allowedServices,
      inputRouting,
    } = this.props;
    const { peerActivation } = this.state;
    const { runtimes } = boardContext;
    return (
      <div>
        <div style={s(t.w100)}>
          <PeersProvider ref={(ctx) => (this.peerContext = ctx)}>
            <PeersConsumer>
              {(peers) =>
                runtimes.map((runtime, rtidx) => {
                  const isPeerActive =
                    !!peerActivation[getActivationId(runtime.id)];
                  return (
                    <Peer
                      key={`playground-peer-${runtime.id}`}
                      name={`${boardName}-${runtime.name}`}
                      onData={(envelope) => {
                        const { sender, data } = envelope;
                        const input = inputRouting[runtime.id];
                        if (input === "*" || input === sender) {
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
                      {this.renderRuntime(
                        boardContext,
                        runtime,
                        peers,
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
        <SaveBoardPrompt ref={(prompt) => (this.prompt = prompt)} />
        <VSpacer />
      </div>
    );
  }
}
