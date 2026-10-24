import { DragEvent, useState } from "react";
import { BoardContextState } from "../../../BoardContext";
import BoardRuntime from "../../playground/Board/BoardRuntime";
import {
  RuntimeDescriptor,
  ProcessContext,
  toCanonicalRuntimeClassType,
} from "../../../types";
import { getDraggedFiles, readFile } from "../../playground/common";
import { forwardResult } from "./forwardResult";
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

export default function CloudBoard({
  boardContext,
  boardName,
  description,
  bridgeWs,
}: Props) {
  const onRuntimeResult = async (
    runtime: RuntimeDescriptor,
    _uuid: string | null,
    result: unknown,
    context: ProcessContext | null | undefined,
  ): Promise<void> => forwardResult(bridgeWs, runtime, result, context);

  const processRuntimeByName = async (
    name: string,
    params: unknown,
    run?: ProcessContext | null,
  ): Promise<unknown> => {
    const rt = boardContext.runtimes.find((r) => r.name === name);
    if (rt) {
      const scope = boardContext.scopes[rt.id];
      const api =
        boardContext.runtimeApis[rt.type] ||
        boardContext.runtimeApis[toCanonicalRuntimeClassType(rt.type)];
      if (scope && api) {
        return api.processRuntime(scope, params, null, run);
      }
    }
    console.error(
      `CloudBoard.processRuntimeByName: no runtime named "${name}"`,
    );
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
            style={{ fontSize: 11.5, color: "var(--hkp-accent-secondary)" }}
          >
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
