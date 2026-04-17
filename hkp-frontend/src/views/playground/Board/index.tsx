import { useRef } from "react";

import { s, t } from "../../../styles";
import Description from "../Description";
import VSpacer from "../../../components/shared/VSpacer";
import {
  RuntimeDescriptor,
  ProcessContext,
  toCanonicalRuntimeClassType,
} from "../../../types";
import { BoardContextState } from "../../../BoardContext";
import BoardRuntime from "./BoardRuntime";

type Props = {
  boardContext: BoardContextState;
  boardName: string;
  description?: string;
  headless?: boolean;
  onResult?: (result: any) => void;
};

export default function Board(props: Props) {
  const pendingBoardCallbacks = useRef<{
    [reqId: string]: (result: any) => void;
  }>({});

  const getNextRuntime = (
    runtime: RuntimeDescriptor,
  ): RuntimeDescriptor | null => {
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
    result: any,
  ) => {
    const callback =
      context && pendingBoardCallbacks.current[context.requestId];
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
  ) => {
    registerPendingBoardCallback(context);

    const nextRuntime = getNextRuntime(runtime);
    const nextScope = nextRuntime && props.boardContext.scopes[nextRuntime.id];
    const nextApi =
      nextScope &&
      (props.boardContext.runtimeApis[nextRuntime.type] ||
        props.boardContext.runtimeApis[
          toCanonicalRuntimeClassType(nextRuntime.type)
        ]);

    if (nextApi && result !== null) {
      nextApi.processRuntime(nextScope, result, null, context);
    } else {
      processPendingBoardCallbacks(context, result);
      if (props.onResult && result !== null) {
        props.onResult(result);
      }
    }
  };

  const processRuntimeByName = async (
    name: string,
    params: any,
  ): Promise<any> => {
    const rt = props.boardContext.runtimes.find((rt) => rt.name === name);
    if (rt) {
      const scope = props.boardContext.scopes[rt.id];
      const api =
        props.boardContext.runtimeApis[rt.type] ||
        props.boardContext.runtimeApis[toCanonicalRuntimeClassType(rt.type)];
      if (scope && api) {
        return api.processRuntime(scope, params, null);
      }
    }
    console.error(`Board.processRuntimeByName: no runtime named "${name}"`);
    return null;
  };

  const { description, boardName, boardContext } = props;
  return (
    <div className="flex flex-col">
      <div style={s(t.w100)}>
        {boardContext.runtimes.map((runtime, runtimeIdx) => (
          <BoardRuntime
            key={runtime.id}
            runtime={runtime}
            runtimeIdx={runtimeIdx}
            boardContext={boardContext}
            boardName={boardName}
            headless={props.headless}
            onRuntimeResult={onRuntimeResult}
            onDrop={(runtimeId, newIndex) =>
              boardContext.arrangeRuntime(runtimeId, newIndex)
            }
            processRuntimeByName={processRuntimeByName}
          />
        ))}
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
