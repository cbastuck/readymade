import { useRef } from "react";
import { PeersContextState } from "../../../PeersContext";
import Peer from "../../../components/Peer";
import Runtime, { RuntimeHandle } from "../../../components/Runtime";
import DragProvider from "../../../DragContext";
import OutputOptions from "../../../components/shared/OutputOptions";
import InputOptions, {
  InputOptionsHandle,
} from "../../../components/shared/InputOptions";
import { BoardContextState } from "../../../BoardContext";
import {
  RuntimeDescriptor,
  RuntimeInputOptions,
  RuntimeInputRoutings,
  RuntimeOutputOptions,
  RuntimeOutputRoutings,
  SidechainRoute,
  SidechainRouting,
  ProcessContext,
} from "../../../types";
import { getActivationId } from "../common";
import RuntimeWithDropBars from "../RuntimeWithDropBars";
import PeerToggle from "./PeerToggle";

type Props = {
  runtime: RuntimeDescriptor;
  runtimeIdx: number;
  boardContext: BoardContextState;
  peersContext: PeersContextState | null;
  peerInputActivation: RuntimeInputRoutings;
  peerOutputActivation: RuntimeOutputRoutings;
  boardName: string;
  headless?: boolean;
  inputRouting: RuntimeInputRoutings;
  outputRouting: RuntimeOutputRoutings;
  onRuntimeResult: (
    runtime: RuntimeDescriptor,
    uuid: string | null,
    result: any,
    context: ProcessContext | null | undefined,
    peersContext: PeersContextState | null
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeInputOptions
  ) => void;
  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeOutputOptions
  ) => void;
  sidechainRouting: SidechainRouting | null;
  onChangeSidechainRouting: (
    runtime: RuntimeDescriptor,
    routes: Array<SidechainRoute>
  ) => void;
  onDrop: (runtimeId: string, newIndex: number) => void;
  processRuntimeByName: (name: string, params: any) => Promise<any>;
};

export default function BoardRuntime({
  runtime,
  runtimeIdx,
  boardContext,
  peersContext,
  peerInputActivation,
  peerOutputActivation,
  boardName,
  headless,
  inputRouting,
  outputRouting,
  onRuntimeResult,
  sidechainRouting,
  onChangeInputRouting,
  onChangeOutputRouting,
  onChangeSidechainRouting,
  onDrop,
  processRuntimeByName,
}: Props) {
  const runtimeInstanceRef = useRef<RuntimeHandle | null>(null);
  const inputSelectorRef = useRef<InputOptionsHandle | null>(null);

  const activationId = getActivationId(runtime.id);
  const inputActivation = peerInputActivation[activationId];
  const outputActivation = peerOutputActivation[activationId];
  const hostDescriptor =
    inputActivation?.hostDescriptor || outputActivation?.hostDescriptor;

  const ownPeers = boardContext.runtimes.map((rt: RuntimeDescriptor) => `${boardName}-${rt.name}`);
  const filteredPeers =
    peersContext?.peerNames.filter((x) => !ownPeers.includes(x)) || [];

  const peerToggleProps = {
    runtime,
    peerInputActivation,
    peerOutputActivation,
    onChangeInputRouting,
    onChangeOutputRouting,
  };

  const outputs =
    runtime.type === "browser" ? (
      <OutputOptions
        id={runtime.id}
        items={filteredPeers}
        value={outputActivation?.route?.peer || null}
        onSelect={(peer: string | null) => {
          if (outputActivation) {
            if (outputActivation.route?.peer) {
              peersContext?.closeConnection(
                `${boardName}-${runtime.name}`,
                outputActivation.route.peer
              );
            }
            onChangeOutputRouting(runtime, {
              ...outputActivation,
              route: { ...outputActivation.route, peer },
            });
          }
        }}
        onAction={(action) => {
          switch (action.type) {
            case "update-peers":
              peersContext?.updatePeers();
              break;
            case "flow-changed":
              if (action.flow) {
                onChangeOutputRouting(
                  runtime,
                  outputActivation
                    ? { ...outputActivation, flow: action.flow }
                    : {
                        hostDescriptor: null,
                        route: { peer: null },
                        flow: action.flow,
                      }
                );
              }
              break;
            default:
              break;
          }
        }}
        flow={outputActivation?.flow}
        boardContext={boardContext}
        sidechainRouting={sidechainRouting?.[runtime.id] ?? []}
        onSidechangeRouting={(routes) =>
          onChangeSidechainRouting(runtime, routes)
        }
        disabled={!outputActivation?.hostDescriptor}
      >
        <PeerToggle {...peerToggleProps} type="output" />
      </OutputOptions>
    ) : undefined;

  const inputs =
    runtime.type === "browser" ? (
      <InputOptions
        ref={inputSelectorRef}
        items={filteredPeers}
        value={inputActivation?.route?.peer || null}
        onAction={(action) => {
          if (action.type === InputOptions.updatePeersAction) {
            peersContext?.updatePeers();
          }
        }}
        onSelect={(value: string | null) => {
          onChangeInputRouting(
            runtime,
            value === null
              ? { ...inputActivation, route: { peer: null } }
              : { ...inputActivation, route: { peer: value } }
          );
        }}
        disabled={!inputActivation?.hostDescriptor}
      >
        <PeerToggle {...peerToggleProps} type="input" />
      </InputOptions>
    ) : undefined;

  return (
    <DragProvider style={{ marginBottom: 5, marginTop: 5 }}>
      <RuntimeWithDropBars index={runtimeIdx} onDrop={onDrop}>
        <Peer
          key={`${boardName}-runtime-peer-${runtime.id}`}
          name={`${boardName}-${runtime.name}`}
          onData={(envelope) => {
            const { sender, data } = envelope;
            const isWildcard =
              inputActivation?.route?.peer === InputOptions.allInputsWildcard;
            if (isWildcard || inputActivation?.route?.peer === sender) {
              const scope = boardContext.scopes[runtime.id];
              const api = boardContext.runtimeApis[runtime.type];
              if (scope && api) {
                api.processRuntime(scope, data, null);
              }
            } else {
              inputSelectorRef.current?.signalIncoming(sender);
            }
          }}
          onConnectionClosed={(closedPeer) => {
            const isInputConnection = closedPeer === `${boardName}-${runtime.name}`;
            let reconnectCallback: (() => void) | null = null;

            if (isInputConnection) {
              const closedInputRouting = inputRouting[runtime.id];
              if (
                closedInputRouting?.route?.peer !==
                InputOptions.allInputsWildcard
              ) {
                onChangeInputRouting(runtime, {
                  ...inputActivation,
                  route: { peer: null },
                });
              }
              reconnectCallback =
                closedInputRouting?.route?.peer ===
                InputOptions.allInputsWildcard
                  ? null
                  : () => {
                      onChangeInputRouting(runtime, {
                        ...inputActivation,
                        ...closedInputRouting,
                      });
                    };
            } else {
              const closedOutputPeer = outputRouting[runtime.id]?.route?.peer;
              onChangeOutputRouting(runtime, {
                hostDescriptor: outputActivation?.hostDescriptor || null,
                route: { ...(outputActivation?.route || { peer: null }), peer: null },
                flow: outputActivation?.flow || "pass",
              });
              reconnectCallback = closedOutputPeer
                ? () => {
                    onChangeOutputRouting(runtime, {
                      hostDescriptor: hostDescriptor || null,
                      route: { peer: closedOutputPeer },
                      flow: outputActivation?.flow || "pass",
                    });
                  }
                : null;
            }

            boardContext.appContext?.pushNotification({
              type: "info",
              message: `Connection in runtime "${runtime.name}" to peer "${closedPeer}" was closed`,
              action: reconnectCallback
                ? { label: "redo", callback: reconnectCallback }
                : undefined,
            });
          }}
          active={!!hostDescriptor}
          peerHost={hostDescriptor?.host}
          usePeerPort={hostDescriptor?.port}
          usePeerRoutePath={hostDescriptor?.path}
          isSecure={hostDescriptor?.secure}
        >
          <Runtime
            key={`board-${runtime.id}`}
            initialState={runtime.state}
            ref={runtimeInstanceRef}
            boardContext={boardContext}
            runtime={runtime}
            onResult={(uuid, result, context) =>
              onRuntimeResult(runtime, uuid, result, context, peersContext) as unknown as Promise<void>
            }
            processRuntimeByName={processRuntimeByName}
            outputs={outputs}
            inputs={inputs}
            headless={headless}
          />
        </Peer>
      </RuntimeWithDropBars>
    </DragProvider>
  );
}
