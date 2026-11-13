import { useMemo, useSyncExternalStore } from "react";

import { BindingSite, ServiceBinding, siteKey } from "./bindings";

/**
 * What a facade sent to the board: each configure and process a widget — or
 * the facade on opening — dispatched, with the payload as it went out, after
 * `$state`, `$user`, `$$input` and `{{value}}` were filled in.
 *
 * Recorded where the facade dispatches rather than where a service receives,
 * because the facade knows what it sent whichever runtime holds the service:
 * a remote one, or one reached through a coordinator, needs no part in it.
 * Read under the widget's "Acts on" binding it went to.
 */

export type SentVerb = "configure" | "process";

/** One call a facade sent: when, to which service, how, and with what. */
export type SentCall = {
  at: number;
  service: string;
  verb: SentVerb;
  payload: unknown;
};

/**
 * The latest calls per sender, newest first and bounded.
 *
 * Kept outside React state: a knob or an XY pad sends on every move, and a
 * state update per move would redraw the whole facade for the sake of an
 * overlay that is usually closed. What reads it subscribes instead.
 */
export type SendLog = {
  record: (sender: BindingSite, call: Omit<SentCall, "at">) => void;
  /** The calls a sender made, newest first; the same array until it sends. */
  of: (sender: BindingSite) => SentCall[];
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
};

const NONE: SentCall[] = [];

export function createSendLog(limit: number): SendLog {
  let calls: Record<string, SentCall[]> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    record: (sender, call) => {
      const key = siteKey(sender);
      calls = {
        ...calls,
        [key]: [{ at: Date.now(), ...call }, ...(calls[key] ?? [])].slice(
          0,
          limit,
        ),
      };
      notify();
    },
    of: (sender) => calls[siteKey(sender)] ?? NONE,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear: () => {
      calls = {};
      notify();
    },
  };
}

/**
 * The calls `sender` made along one of its bindings, newest first: those to
 * the binding's service with the binding's verb. Empty for a binding that
 * sends nothing a facade dispatches — a file handed over, frames captured.
 */
export function useSentCalls(
  log: SendLog | undefined,
  sender: BindingSite | undefined,
  binding: ServiceBinding,
): SentCall[] {
  const verb =
    binding.role === "sends" &&
    (binding.verb === "configure" || binding.verb === "process")
      ? binding.verb
      : null;
  const subscribe = log?.subscribe ?? noSubscription;
  const all = useSyncExternalStore(subscribe, () =>
    log && sender && verb ? log.of(sender) : NONE,
  );
  return useMemo(
    () =>
      all === NONE
        ? NONE
        : all.filter(
            (call) => call.service === binding.service && call.verb === verb,
          ),
    [all, binding.service, verb],
  );
}

function noSubscription() {
  return () => {};
}
