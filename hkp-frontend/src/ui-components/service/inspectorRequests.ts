import { createRequestChannel } from "../requestChannel";
import type { FlowSide } from "./flowRecords";

/**
 * Asking a service's flow inspector to open from outside its frame — from a
 * facade widget's Inspect, which knows the service but holds none of the
 * frame's state.
 *
 * Keyed by the uuid the frame renders under (`service-frame-<uuid>`), the same
 * id a reveal looks for. A request made before the frame has mounted waits as
 * long as a reveal does; see `createRequestChannel`. Where two frames share a
 * uuid — two copies of a block — the first listening takes it, as the reveal
 * scrolls to the first.
 */

export const INSPECTOR_REQUEST_TTL_MS = 2000;

const channel = createRequestChannel<FlowSide>(INSPECTOR_REQUEST_TTL_MS);

export const requestInspector = channel.request;
export const onInspectorRequest = channel.listen;
export const useInspectorRequest = channel.useRequest;
