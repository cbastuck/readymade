import { useRef } from "react";

import PeersProvider, {
  usePeersContext,
  PeersContextState,
} from "../../../PeersContext";
import { s, t } from "../../../styles";
import Description from "../Description";
import VSpacer from "../../../components/shared/VSpacer";
import {
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  RuntimeDescriptor,
  RuntimeInputOptions,
  RuntimeOutputOptions,
  SidechainRoute,
  SidechainRouting,
  ProcessContext,
} from "../../../types";
import { BoardContextState } from "../../../BoardContext";
import { usePeerActivation } from "./hooks/usePeerActivation";
import BoardRuntime from "./BoardRuntime";

type BoardRuntimesListProps = {
  renderRuntimes: (peersContext: PeersContextState | null) => React.ReactNode;
};

function BoardRuntimesList({ renderRuntimes }: BoardRuntimesListProps) {
  const peersContext = usePeersContext();
  return <>{renderRuntimes(peersContext)}</>;
}

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
  const { peerInputActivation, peerOutputActivation } = usePeerActivation(
    props.inputRouting,
    props.outputRouting
  );

  const pendingBoardCallbacks = useRef<{ [reqId: string]: (result: any) => void }>({});

  const getNextRuntime = (runtime: RuntimeDescriptor): RuntimeDescriptor | null => {
    const { runtimes = [] } = props.boardContext;
    const pos = runtimes.findIndex((rt) => rt.id === runtime.id);
    return pos !== -1 ? runtimes[pos + 1] : null;
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

  const onRuntimeResult = async (
    runtime: RuntimeDescriptor,
    _uuid: string | null,
    result: any,
    context: ProcessContext | null | undefined,
    peersContext: PeersContextState | null
  ) => {
    const { sidechainRouting, outputRouting, boardName } = props;

    const sroute = sidechainRouting?.[runtime.id];
    if (sroute) {
      for (const route of sroute) {
        const dstRuntime = props.boardContext.runtimes.find(
          (rt) => rt.id === route.runtimeId
        );
        const dstScope = dstRuntime && props.boardContext.scopes[dstRuntime.id];
        const api = dstScope && props.boardContext.runtimeApis[dstRuntime.type];
        if (dstScope && api) {
          const config = typeof result === "string" ? JSON.parse(result) : result;
          await api.configureService(dstScope, { uuid: route.serviceUuid }, config);
        } else {
          console.error(
            "Board.onRuntimeResult() sidechain destination not found",
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
      const nextScope = nextRuntime && props.boardContext.scopes[nextRuntime.id];
      const nextApi = nextScope && props.boardContext.runtimeApis[nextRuntime.type];
      if (nextApi && result !== null) {
        nextApi.processRuntime(nextScope, result, null, context);
      } else {
        processPendingBoardCallbacks(context, result);
        if (props.onResult && result !== null) {
          props.onResult(result);
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

  const processRuntimeByName = async (name: string, params: any): Promise<any> => {
    const rt = props.boardContext.runtimes.find((rt) => rt.name === name);
    if (rt) {
      const scope = props.boardContext.scopes[rt.id];
      const api = props.boardContext.runtimeApis[rt.type];
      if (scope && api) {
        return api.processRuntime(scope, params, null);
      }
    }
    console.error(`Board.processRuntimeByName: no runtime named "${name}"`);
    return null;
  };

  const { description, boardName, boardContext } = props;
  return (
    <div className="flex flex-col h-full">
      <div style={s(t.w100)}>
        <PeersProvider>
          <BoardRuntimesList
            renderRuntimes={(peersContext) =>
              boardContext.runtimes.map((runtime, runtimeIdx) => (
                <BoardRuntime
                  key={runtime.id}
                  runtime={runtime}
                  runtimeIdx={runtimeIdx}
                  boardContext={boardContext}
                  peersContext={peersContext}
                  peerInputActivation={peerInputActivation}
                  peerOutputActivation={peerOutputActivation}
                  boardName={boardName}
                  headless={props.headless}
                  inputRouting={props.inputRouting}
                  outputRouting={props.outputRouting}
                  onRuntimeResult={onRuntimeResult}
                  onChangeInputRouting={props.onChangeInputRouting}
                  onChangeOutputRouting={props.onChangeOutputRouting}
                  sidechainRouting={props.sidechainRouting}
                  onChangeSidechainRouting={props.onChangeSidechainRouting}
                  onDrop={(runtimeId, newIndex) =>
                    boardContext.arrangeRuntime(runtimeId, newIndex)
                  }
                  processRuntimeByName={processRuntimeByName}
                />
              ))
            }
          />
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
