import { useState, useEffect, useRef } from "react";

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

export default function Board(props: Props) {
  const [peerOutputActivation, setPeerOutputActivation] = useState<RuntimeOutputRoutings>({});
  const [peerInputActivation, setPeerInputActivation] = useState<RuntimeInputRoutings>({});

  const runtimeInstances = useRef<{ [runtimeId: string]: Runtime | null }>({});
  const inputSelectors = useRef<{ [runtimeId: string]: InputOptions | null }>({});
  const pendingBoardCallbacks = useRef<{ [reqId: string]: (result: any) => void }>({});

  const updateInputActivation = (inputRoutingArg: RuntimeInputRoutings) => {
    const newPeerInputActivation = inputRoutingArg
      ? Object.keys(inputRoutingArg).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeInputRouting = inputRoutingArg[runtimeId];
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

    setPeerInputActivation((state) => ({ ...state, ...newPeerInputActivation }));
  };

  const updateOutputActivation = (outputRoutingArg: RuntimeOutputRoutings) => {
    const newPeerOutputActivation = outputRoutingArg
      ? Object.keys(outputRoutingArg).reduce((all, runtimeId) => {
          const activationId = getActivationId(runtimeId);
          const runtimeOutputRouting = outputRoutingArg[runtimeId];
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

    setPeerOutputActivation((state) => ({ ...state, ...newPeerOutputActivation }));
  };

  // componentDidMount
  useEffect(() => {
    updateInputActivation(props.inputRouting);
    updateOutputActivation(props.outputRouting);
  }, []);

  // componentDidUpdate for inputRouting
  const prevInputRoutingRef = useRef(props.inputRouting);
  useEffect(() => {
    if (prevInputRoutingRef.current !== props.inputRouting) {
      updateInputActivation(props.inputRouting);
    }
    prevInputRoutingRef.current = props.inputRouting;
  });

  // componentDidUpdate for outputRouting
  const prevOutputRoutingRef = useRef(props.outputRouting);
  useEffect(() => {
    if (prevOutputRoutingRef.current !== props.outputRouting) {
      updateOutputActivation(props.outputRouting);
    }
    prevOutputRoutingRef.current = props.outputRouting;
  });

  const getNextRuntime = (runtime: RuntimeDescriptor): RuntimeDescriptor | null => {
    const { runtimes = [] } = props.boardContext;
    const pos = runtimes.findIndex((rt) => rt.id === runtime.id);
    return pos !== -1 ? runtimes[pos + 1] : null;
  };

  const getRuntimeById = (runtimeId: string): RuntimeDescriptor | null => {
    const { runtimes = [] } = props.boardContext;
    const runtime = runtimes.find((rt) => rt.id === runtimeId);
    if (!runtime) {
      console.error("Unknown runtime", runtimeId, runtimes);
    }
    return runtime || null;
  };

  const registerPendingBoardCallback = (context?: ProcessContext | null) => {
    if (context?.onResolve) {
      pendingBoardCallbacks.current[context.requestId] = context.onResolve;
    }
  };

  const processPendingBoardCallbacks = (
    context: ProcessContext | null | undefined,
    result: any
  ) => {
    const callback = context && pendingBoardCallbacks.current[context.requestId];
    if (callback) {
      callback(result);
      delete pendingBoardCallbacks.current[context.requestId];
    }
  };

  const onResult = async (
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    _svcUuid: string | null,
    result: any,
    context?: ProcessContext | null
  ) => {
    const { sidechainRouting, outputRouting, boardName } = props;
    const sroute = sidechainRouting && sidechainRouting[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dstRuntime = props.boardContext.runtimes.find(
          (rt) => rt.id === route.runtimeId
        );
        const dstScope =
          dstRuntime && props.boardContext.scopes[dstRuntime.id];
        const api =
          dstScope && props.boardContext.runtimeApis[dstRuntime.type];
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
            props.boardContext.scopes,
            dstScope,
            api
          );
        }
      }
    }

    registerPendingBoardCallback(context);

    const runtimeOutput = outputRouting[runtime.id] || {};
    const flow = runtimeOutput?.flow || "pass";
    if (flow === "pass") {
      const nextRuntime = getNextRuntime(runtime);
      const nextScope =
        nextRuntime && props.boardContext.scopes[nextRuntime.id];
      const nextApi =
        nextScope && props.boardContext.runtimeApis[nextRuntime.type];
      if (nextApi && result !== null) {
        nextApi.processRuntime(nextScope, result, null, context);
      } else {
        processPendingBoardCallbacks(context, result);
        if (props.onResult) {
          if (result !== null) {
            // null means stop the process
            props.onResult(result);
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

  const getPeerName = (runtime: RuntimeDescriptor) =>
    `${props.boardName}-${runtime.name}`;

  const renderPeersActivator = (
    runtime: RuntimeDescriptor,
    type: "input" | "output",
    currentPeerOutputActivation: RuntimeOutputRoutings,
    currentPeerInputActivation: RuntimeInputRoutings
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputActivation = currentPeerInputActivation[activationId];
    const outputActivation = currentPeerOutputActivation[activationId];
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
                props.onChangeOutputRouting(runtime, {
                  route: outputRoute,
                  hostDescriptor: availableDiscoveryPeerHosts[index],
                  flow: outputActivation?.flow || "pass",
                });
              } else {
                const inputRoute = inputActivation?.route || {
                  peer: null,
                  flow: "pass",
                };
                props.onChangeInputRouting(runtime, {
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
              props.onChangeOutputRouting(runtime, {
                route: outputRoute,
                hostDescriptor: selectedDiscoveryServer,
                flow: outputActivation?.flow || "pass",
              });
            } else {
              props.onChangeInputRouting(runtime, {
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

  const renderPeersDeactivator = (
    runtime: RuntimeDescriptor,
    type: "input" | "output",
    currentPeerOutputActivation: RuntimeOutputRoutings,
    currentPeerInputActivation: RuntimeInputRoutings
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputRoute = currentPeerInputActivation[activationId];
    const outputRoute = currentPeerOutputActivation[activationId];
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
              props.onChangeInputRouting(runtime, {
                ...(inputRoute || {}),
                hostDescriptor: null,
              });
            } else {
              if (outputRoute) {
                props.onChangeOutputRouting(runtime, {
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

  const renderOutputs = (
    peers: Array<string>,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    boardContext: BoardContextState,
    currentPeerOutputActivation: RuntimeOutputRoutings,
    currentPeerInputActivation: RuntimeInputRoutings
  ) => {
    const activationId = getActivationId(runtime.id);
    const { sidechainRouting } = props;
    const runtimeSidechainRouting =
      sidechainRouting && sidechainRouting[runtime.id];

    const outputActivation = currentPeerOutputActivation[activationId];
    return (
      <OutputOptions
        id={runtime.id}
        items={peers}
        value={outputActivation?.route?.peer || null}
        onSelect={(peer: string | null) => {
          if (outputActivation) {
            if (outputActivation?.route?.peer) {
              const srcPeer = getPeerName(runtime);
              const dstPeer = outputActivation.route.peer;
              peersContext?.closeConnection(srcPeer, dstPeer);
            }
            if (outputActivation) {
              props.onChangeOutputRouting(runtime, {
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
                props.onChangeOutputRouting(
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
          props.onChangeSidechainRouting(runtime, routes)
        }
        disabled={!outputActivation?.hostDescriptor}
      >
        {renderPeersActivator(runtime, "output", currentPeerOutputActivation, currentPeerInputActivation)}
        {renderPeersDeactivator(runtime, "output", currentPeerOutputActivation, currentPeerInputActivation)}
      </OutputOptions>
    );
  };

  const renderInputs = (
    peers: Array<string>,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    currentPeerOutputActivation: RuntimeOutputRoutings,
    currentPeerInputActivation: RuntimeInputRoutings
  ) => {
    const activationId = getActivationId(runtime.id);
    const inputActivation = currentPeerInputActivation[activationId];
    return (
      <InputOptions
        ref={(selector) => (inputSelectors.current[runtime.id] = selector)}
        items={peers}
        value={
          currentPeerInputActivation[activationId]?.route?.peer || null
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
          const input = currentPeerInputActivation[activationId];
          props.onChangeInputRouting(
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
        {renderPeersActivator(runtime, "input", currentPeerOutputActivation, currentPeerInputActivation)}
        {renderPeersDeactivator(runtime, "input", currentPeerOutputActivation, currentPeerInputActivation)}
      </InputOptions>
    );
  };

  const processRuntimeByName = async (name: string, params: any): Promise<any> => {
    const rt = props.boardContext.runtimes.find((rt) => rt.name === name);
    if (rt) {
      const scope = props.boardContext.scopes[rt.id];
      const api = props.boardContext.runtimeApis[rt.type];
      if (scope && api) {
        return api.processRuntime(scope, params, null);
      }
    }
    console.error(
      `Board.processRuntimeByName could not process runtime with name: ${name}`
    );
    return null;
  };

  const renderRuntime = (
    boardContext: BoardContextState,
    runtime: RuntimeDescriptor,
    peersContext: PeersContextState | null,
    runtimeIdx: number,
    currentPeerOutputActivation: RuntimeOutputRoutings,
    currentPeerInputActivation: RuntimeInputRoutings
  ) => {
    const { boardName } = props;
    const ownPeers = boardContext.runtimes.map(
      (rt) => `${boardName}-${rt.name}`
    );
    const filteredPeers =
      peersContext?.peerNames.filter((x) => ownPeers.indexOf(x) === -1) || [];

    const onResultCallback = (
      uuid: string | null,
      result: any,
      context?: ProcessContext | null
    ) => onResult(runtime, peersContext, uuid, result, context);
    const outputs =
      runtime.type === "browser"
        ? renderOutputs(filteredPeers, runtime, peersContext, boardContext, currentPeerOutputActivation, currentPeerInputActivation)
        : undefined;
    const inputs =
      runtime.type === "browser"
        ? renderInputs(filteredPeers, runtime, peersContext, currentPeerOutputActivation, currentPeerInputActivation)
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
            ref={(rt) => (runtimeInstances.current[runtime.id] = rt)}
            boardContext={boardContext}
            runtime={runtime}
            onResult={onResultCallback}
            processRuntimeByName={processRuntimeByName}
            outputs={outputs}
            inputs={inputs}
            headless={props.headless}
          />
        </RuntimeWithDropBars>
      </DragProvider>
    );
  };

  const { description, boardName } = props;
  return (
    <div className="flex flex-col h-full">
      <div style={s(t.w100)}>
        <PeersProvider>
          <PeersConsumer>
            {(peersContext) =>
              props.boardContext.runtimes.map((runtime, runtimeIdx) => {
                const activationId = getActivationId(runtime.id);
                const inputActivation =
                  peerInputActivation[activationId];
                const outputActivation =
                  peerOutputActivation[activationId];
                const hostDescriptor =
                  inputActivation?.hostDescriptor ||
                  outputActivation?.hostDescriptor;
                const peerName = getPeerName(runtime);
                return (
                  <Peer
                    key={`${boardName}-runtime-peer-${runtime.id}`}
                    name={peerName}
                    onData={(envelope) => {
                      const { sender, data } = envelope;
                      const input =
                        peerInputActivation[activationId];
                      const isWildcardInput =
                        input?.route?.peer === InputOptions.allInputsWildcard;
                      if (isWildcardInput || input?.route?.peer === sender) {
                        const rt = getRuntimeById(runtime.id);
                        if (rt) {
                          const scope = props.boardContext.scopes[rt.id];
                          const api =
                            props.boardContext.runtimeApis[rt.type];
                          if (scope && api) {
                            api.processRuntime(scope, data, null);
                          }
                        }
                      } else {
                        const selector = inputSelectors.current[runtime.id];
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
                          props.inputRouting[runtime.id];

                        if (
                          closedInputRouting?.route?.peer !==
                          InputOptions.allInputsWildcard
                        ) {
                          props.onChangeInputRouting(runtime, {
                            ...inputActivation,
                            route: { peer: null },
                          });
                        }

                        reconnectCallback = // no reconnect for wildcard inputs
                          closedInputRouting?.route?.peer ===
                          InputOptions.allInputsWildcard
                            ? null
                            : () => {
                                props.onChangeInputRouting(runtime, {
                                  ...inputActivation,
                                  ...closedInputRouting,
                                });
                              };
                      } else {
                        const closedOutputRouting =
                          props.outputRouting[runtime.id]?.route?.peer;
                        props.onChangeOutputRouting(runtime, {
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
                              props.onChangeOutputRouting(runtime, {
                                hostDescriptor: hostDescriptor || null,
                                route: {
                                  peer: closedOutputRouting,
                                },
                                flow: outputActivation?.flow || "pass",
                              });
                            }
                          : null;
                      }
                      props.boardContext.appContext?.pushNotification({
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
                    {renderRuntime(
                      props.boardContext,
                      runtime,
                      peersContext,
                      runtimeIdx,
                      peerOutputActivation,
                      peerInputActivation
                    )}
                  </Peer>
                );
              })
            }
          </PeersConsumer>
        </PeersProvider>
      </div>
      {description && !props.headless && (
        <>
          <Description description={description} boardName={boardName} />
          <VSpacer />
        </>
      )}
    </div>
  );
}

function formatHostAndPort(availablePeer: PeerJsHostDescriptor) {
  const { host, port, secure } = availablePeer;
  const protocol = secure ? "wss" : "ws";
  return `${protocol}://${host}:${port}`;
}
