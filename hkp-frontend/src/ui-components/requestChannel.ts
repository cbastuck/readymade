import { useEffect, useRef } from "react";

/**
 * Asking a component that owns some state to change it, from outside it — a
 * frame to open its inspector, a runtime to expand — where that component is
 * found by an id rather than held.
 *
 * The component owns the state, so a request is a message to it rather than a
 * flag set on it. A request can be made before its component has mounted —
 * revealing a nested service opens its levels first, and what is inside them
 * only exists once they have rendered — so one that finds nobody listening is
 * kept for `ttlMs` and taken by the component that mounts for it. Kept no
 * longer, so one mounted later for some other reason is not asked for
 * something nobody wants any more.
 *
 * Where two listeners share an id, the first listening takes the request.
 */
export type RequestChannel<T> = {
  request: (id: string, value: T) => void;
  /** Listens for requests to `id`; returns how to stop. */
  listen: (id: string, listener: (value: T) => void) => () => void;
  /** `listen` for as long as the caller is mounted. */
  useRequest: (id: string | undefined, onRequest: (value: T) => void) => void;
};

export function createRequestChannel<T>(ttlMs: number): RequestChannel<T> {
  const listeners = new Map<string, ((value: T) => void)[]>();
  const pending = new Map<string, { value: T; until: number }>();

  const request = (id: string, value: T) => {
    const first = listeners.get(id)?.[0];
    if (first) {
      pending.delete(id);
      first(value);
      return;
    }
    pending.set(id, { value, until: Date.now() + ttlMs });
  };

  const listen = (id: string, listener: (value: T) => void) => {
    listeners.set(id, [...(listeners.get(id) ?? []), listener]);
    const waiting = pending.get(id);
    if (waiting) {
      pending.delete(id);
      if (waiting.until >= Date.now()) {
        listener(waiting.value);
      }
    }
    return () => {
      const rest = (listeners.get(id) ?? []).filter((each) => each !== listener);
      if (rest.length > 0) {
        listeners.set(id, rest);
      } else {
        listeners.delete(id);
      }
    };
  };

  function useRequest(id: string | undefined, onRequest: (value: T) => void) {
    const handler = useRef(onRequest);
    handler.current = onRequest;
    useEffect(() => {
      if (!id) {
        return;
      }
      return listen(id, (value) => handler.current(value));
    }, [id]);
  }

  return { request, listen, useRequest };
}
