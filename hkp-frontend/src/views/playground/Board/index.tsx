import { DragEvent, useRef, useState } from "react";

import { s, t } from "../../../styles";
import Description from "../Description";
import VSpacer from "../../../components/shared/VSpacer";
import {
  RuntimeDescriptor,
  ProcessContext,
  toCanonicalRuntimeClassType,
  isRuntimeDescriptorConfig,
} from "../../../types";
import { getDraggedFiles, readFile } from "../common";
import { BoardContextState } from "../../../BoardContext";
import { passesNothing } from "../../../runtime/rest/Data";
import { boardRun } from "../../../runtime/processContext";
import BoardRuntime from "./BoardRuntime";
import { useThemeControl } from "../../../ui-components/ThemeContext";
import RuntimeMenu from "../../../ui-components/toolbar/RuntimeMenu";

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
    if (pos === -1) {
      return null;
    }
    const next = runtimes[pos + 1] ?? null;
    // The chain stops at a unit boundary. A unit occupies a contiguous block of
    // runtimes, and units talk to each other over topics — so letting the last
    // runtime of one drive the first of the next would be a wire nobody wrote,
    // created by nothing more than the order they were linked in.
    if (next && next.unit !== runtime.unit) {
      return null;
    }
    return next;
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

    const carriesOn = !passesNothing(result);
    if (nextApi && carriesOn) {
      // A runtime that names no run for what it produced — a remote one's
      // timer, a request arriving at its mount — did not hand over a gesture
      // of whoever is signed in here. It goes on as the board's.
      nextApi.processRuntime(nextScope, result, null, context ?? boardRun());
    } else {
      processPendingBoardCallbacks(context, result);
      if (props.onResult && carriesOn) {
        props.onResult(result);
      }
    }
  };

  const processRuntimeByName = async (
    name: string,
    params: any,
    run?: ProcessContext | null,
  ): Promise<any> => {
    const rt = props.boardContext.runtimes.find((rt) => rt.name === name);
    if (rt) {
      const scope = props.boardContext.scopes[rt.id];
      const api =
        props.boardContext.runtimeApis[rt.type] ||
        props.boardContext.runtimeApis[toCanonicalRuntimeClassType(rt.type)];
      if (scope && api) {
        return api.processRuntime(scope, params, null, run);
      }
    }
    console.error(`Board.processRuntimeByName: no runtime named "${name}"`);
    return null;
  };

  const [isDraggingRuntimeOver, setIsDraggingRuntimeOver] = useState(false);

  const onRuntimeDrop = async (ev: DragEvent) => {
    setIsDraggingRuntimeOver(false);
    ev.preventDefault();
    const files = getDraggedFiles(ev);
    if (files.length !== 1) {
      return;
    }
    const src = await readFile(files[0], true);
    const data = typeof src === "string" && JSON.parse(src);
    if (data && isRuntimeDescriptorConfig(data)) {
      const { services: rawServices, ...runtimeDesc } = data;
      const services = rawServices.map((svc: any) => ({
        uuid: svc.uuid,
        serviceId: svc.serviceId,
        serviceName: svc.serviceName ?? svc.name ?? svc.serviceId,
        state: svc.state,
      }));
      boardContext.setBoardState({
        runtimes: [...boardContext.runtimes, runtimeDesc],
        services: { ...boardContext.services, [data.id]: services },
      });
    }
  };

  const { description, boardName, boardContext } = props;
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  return (
    <div
      className="flex flex-col"
      style={{ padding: "var(--board-padding, 0px)" }}
    >
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
        {isPlayground && (
          <div
            style={{
              padding: "12px 8px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-start",
              borderRadius: 8,
              backgroundColor: isDraggingRuntimeOver
                ? "var(--hkp-accent-secondary-dim)"
                : undefined,
              transition: "background-color 0.15s",
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              setIsDraggingRuntimeOver(true);
            }}
            onDragLeave={() => setIsDraggingRuntimeOver(false)}
            onDrop={onRuntimeDrop}
          >
            <RuntimeMenu />
            {isDraggingRuntimeOver && (
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--hkp-accent-secondary)",
                }}
              >
                Drop to add runtime
              </span>
            )}
          </div>
        )}
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
