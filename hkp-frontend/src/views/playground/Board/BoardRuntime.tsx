import { useRef } from "react";
import Runtime, { RuntimeHandle } from "../../../components/Runtime";
import DragProvider from "../../../DragContext";
import { BoardContextState } from "../../../BoardContext";
import { RuntimeDescriptor, ProcessContext } from "../../../types";
import RuntimeWithDropBars from "../RuntimeWithDropBars";

type Props = {
  runtime: RuntimeDescriptor;
  runtimeIdx: number;
  boardContext: BoardContextState;
  boardName: string;
  headless?: boolean;
  onRuntimeResult: (
    runtime: RuntimeDescriptor,
    uuid: string | null,
    result: any,
    context: ProcessContext | null | undefined,
  ) => void;
  onDrop: (runtimeId: string, newIndex: number) => void;
  processRuntimeByName: (name: string, params: any) => Promise<any>;
};

export default function BoardRuntime({
  runtime,
  runtimeIdx,
  boardContext,
  headless,
  onRuntimeResult,
  onDrop,
  processRuntimeByName,
}: Props) {
  const runtimeInstanceRef = useRef<RuntimeHandle | null>(null);

  return (
    <DragProvider style={{ marginBottom: 25 }}>
      <RuntimeWithDropBars index={runtimeIdx} onDrop={onDrop}>
        <Runtime
          key={`board-${runtime.id}`}
          initialState={runtime.state}
          ref={runtimeInstanceRef}
          boardContext={boardContext}
          runtime={runtime}
          onResult={(uuid, result, context) =>
            onRuntimeResult(
              runtime,
              uuid,
              result,
              context,
            ) as unknown as Promise<void>
          }
          processRuntimeByName={processRuntimeByName}
          headless={headless}
        />
      </RuntimeWithDropBars>
    </DragProvider>
  );
}
