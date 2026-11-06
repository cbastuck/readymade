import { BoardContextState, useBoardContext } from "../../../BoardContext";
import {
  blockUseAt,
  blockUseContaining,
} from "../../../runtime/board/blocks";
import { RuntimeDescriptor, ServiceDescriptor } from "../../../types";
import BottomSheet from "./BottomSheet";
import MobileFlowInspector from "./MobileFlowInspector";

/**
 * How the flow inspector runs a service again, or carries a value on from it.
 *
 * Both push data through the board, so a block's use keeps them out of reach
 * as it keeps its configuration — unless it is the use being edited. Absent
 * where the runtime cannot do it.
 */
export function flowActions(
  boardContext: BoardContextState | null | undefined,
  runtimeId: string,
  uuid: string,
): { onRerun?: (input: any) => void; onInject?: (output: any) => void } {
  const blocks = boardContext?.linkage?.blocks;
  const use = blockUseAt(blocks, uuid, runtimeId);
  const locked =
    (!!use && blocks?.editing !== use.key) ||
    !!blockUseContaining(blocks, uuid, runtimeId);
  const app = locked
    ? null
    : ((boardContext?.scopes[runtimeId] as any)?.getApp?.() ?? null);
  return {
    onRerun: app?.rerun
      ? (input: any) => app.rerun({ uuid }, input)
      : undefined,
    // A replay: the value is pushed back through the board, and the service
    // itself has not produced anything to record.
    onInject: app?.next
      ? (output: any) => app.next({ uuid }, output, { replay: true })
      : undefined,
  };
}

/**
 * The flow inspector on its own, opened from a service's card (Inspect) for
 * watching a board without going through the service's sheet.
 */
export default function FlowSheet({
  open,
  onClose,
  service,
  runtime,
}: {
  open: boolean;
  onClose: () => void;
  service: ServiceDescriptor | null;
  runtime: RuntimeDescriptor | null;
}) {
  const boardContext = useBoardContext();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={service ? `Flow · ${service.serviceName}` : "Flow"}
      height="92%"
    >
      {service && runtime && (
        <MobileFlowInspector
          runtimeId={runtime.id}
          serviceUuid={service.uuid}
          {...flowActions(boardContext, runtime.id, service.uuid)}
        />
      )}
    </BottomSheet>
  );
}
