import { DragEvent, useState } from "react";
import { BoardContextState } from "../../../BoardContext";
import BoardRuntime from "../../playground/Board/BoardRuntime";
import {
  RuntimeDescriptor,
  ProcessContext,
  toCanonicalRuntimeClassType,
  isRuntimeBrowserClassType,
} from "../../../types";
import { getDraggedFiles, readFile } from "../../playground/common";
import { isRuntimeDescriptorConfig } from "../../../types";
import RuntimeMenu from "../../../ui-components/toolbar/RuntimeMenu";
import Description from "../../playground/Description";
import VSpacer from "../../../components/shared/VSpacer";

type Props = {
  boardContext: BoardContextState;
  boardName: string;
  description?: string;
  bridgeWs: WebSocket | null;
};

export default function CloudBoard({ boardContext, boardName, description, bridgeWs }: Props) {
  // The hkp-node coordinator is the sole routing authority for cloud boards.
  // This handler only needs to handle two cases:
  //   1. coordinator-initiated call (context.onResolve set) — respond via onResolve
  //   2. user-initiated browser action — forward result to coordinator via bridge
  // Remote runtime results are ignored here; the coordinator relays them itself.
  const onRuntimeResult = async (
    runtime: RuntimeDescriptor,
    _uuid: string | null,
    result: unknown,
    context: ProcessContext | null | undefined,
  ): Promise<void> => {
    if (context?.onResolve) {
      context.onResolve(result);
      return;
    }

    if (isRuntimeBrowserClassType(runtime.type) && bridgeWs?.readyState === WebSocket.OPEN) {
      bridgeWs.send(
        JSON.stringify({ type: "result-from-browser", runtimeId: runtime.id, data: result }),
      );
    }
  };

  const processRuntimeByName = async (name: string, params: unknown): Promise<unknown> => {
    const rt = boardContext.runtimes.find((r) => r.name === name);
    if (rt) {
      const scope = boardContext.scopes[rt.id];
      const api =
        boardContext.runtimeApis[rt.type] ||
        boardContext.runtimeApis[toCanonicalRuntimeClassType(rt.type)];
      if (scope && api) {
        return api.processRuntime(scope, params, null);
      }
    }
    console.error(`CloudBoard.processRuntimeByName: no runtime named "${name}"`);
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

  return (
    <div
      className="flex flex-col"
      style={{ padding: "var(--board-padding, 0px)" }}
    >
      {boardContext.runtimes.map((runtime, runtimeIdx) => (
        <BoardRuntime
          key={runtime.id}
          runtime={runtime}
          runtimeIdx={runtimeIdx}
          boardContext={boardContext}
          boardName={boardName}
          onRuntimeResult={onRuntimeResult}
          onDrop={(runtimeId, newIndex) =>
            boardContext.arrangeRuntime(runtimeId, newIndex)
          }
          processRuntimeByName={processRuntimeByName}
        />
      ))}

      <div
        style={{
          padding: "12px 8px 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 8,
          backgroundColor: isDraggingRuntimeOver
            ? "var(--hkp-accent-violet-dim)"
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
          <span style={{ fontSize: 11.5, color: "var(--hkp-accent-violet)" }}>
            Drop to add runtime
          </span>
        )}
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
