import {
  ProcessContext,
  RuntimeDescriptor,
  isRuntimeBrowserClassType,
} from "../../../types";
import { passesNothing } from "../../../runtime/rest/Data";

/**
 * What a cloud board does with a runtime's result.
 *
 * The hkp-node coordinator is the sole routing authority for cloud boards, so
 * there are two cases only:
 *   1. a coordinator-initiated call (context.onResolve set) — answer it
 *   2. a run that began in a browser runtime — hand the result to the
 *      coordinator over the bridge
 * Remote runtime results are ignored here; the coordinator relays them itself.
 */
export function forwardResult(
  bridgeWs: Pick<WebSocket, "readyState" | "send"> | null,
  runtime: RuntimeDescriptor,
  result: unknown,
  context: ProcessContext | null | undefined,
): void {
  if (context?.onResolve) {
    context.onResolve(result);
    return;
  }

  // A run that stopped here has nothing for the next runtime, as in the
  // playground. Sent anyway, it would start that runtime on nothing — once
  // for every Spread, whose own run ends in null after its items went on.
  if (
    isRuntimeBrowserClassType(runtime.type) &&
    !passesNothing(result) &&
    bridgeWs?.readyState === WebSocket.OPEN
  ) {
    bridgeWs.send(
      JSON.stringify({
        type: "result-from-browser",
        runtimeId: runtime.id,
        data: result,
        // A source or callback with no active user run is the board's own.
        // The coordinator must not turn it into the owner's merely because
        // the owner's browser happened to host this runtime.
        ...(context?.actor.kind === "board" ? { boardOrigin: true } : {}),
      }),
    );
  }
}
