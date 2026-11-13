import { createRequestChannel } from "../requestChannel";

/**
 * Asking a runtime to expand from outside it — a reveal bringing one of its
 * services into view, which a collapsed runtime does not show.
 *
 * Keyed by runtime id. Whether a runtime is expanded is its own state
 * (`components/Runtime.tsx`), so this is a request it acts on rather than a
 * flag set on it.
 */

const channel = createRequestChannel<void>(2000);

export const requestRuntimeExpanded = (runtimeId: string) =>
  channel.request(runtimeId, undefined);
export const onRuntimeExpandRequest = channel.listen;
export const useRuntimeExpandRequest = channel.useRequest;
