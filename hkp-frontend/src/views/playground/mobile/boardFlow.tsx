import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

import {
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
} from "../../../types";
import {
  CallReading,
  FlowRecord,
  FlowSide,
  readCallReport,
  rememberFlow,
} from "../../../ui-components/service/flowRecords";
import { useProcessingSweep } from "../../../ui-components/service/processingSweep";

/**
 * What every service of the open board received and passed on, for the mobile
 * canvas — the flow inspector's history and the activity on a service card.
 *
 * The desktop keeps this in each service's frame, which is on screen for as
 * long as the board is. A phone shows a service's card and opens its sheet
 * only when asked, so a history kept there would start when the sheet opens
 * and show nothing that happened before. It is kept for the whole board
 * instead, from the moment the board is shown.
 *
 * Kept outside React, like the overview's activity (`overview/activity.ts`):
 * a board driven by a clock reports many times a second, and only the card and
 * the sheet of the service that reported should hear it.
 *
 * Registering for every service is also what makes a service report at all: a
 * runtime sends a call report only for a service something listens to.
 * Services a scope holds inside another are not registered — the sheet's flow
 * is for the services a runtime holds itself (`plans/TODO-MOBILE-PARITY.md`).
 */

export type ServiceFlow = {
  /** What the service was called with, newest first. */
  input: FlowRecord[];
  /** What it passed on, newest first. */
  output: FlowRecord[];
};

const EMPTY: ServiceFlow = { input: [], output: [] };

type Registration = {
  app: { unregisterNotificationTarget?: (svc: any, cb: any) => void };
  target: { uuid: string };
  callback: (notification: any) => void;
};

const keyOf = (runtimeId: string, uuid: string) => `${runtimeId}\n${uuid}`;

export class BoardFlow {
  private flows = new Map<string, ServiceFlow>();
  private flowListeners = new Map<string, Set<() => void>>();
  private callListeners = new Map<string, Set<(reading: CallReading) => void>>();
  private registrations: Registration[] = [];

  /**
   * Listens to every service the runtimes hold. Called again whenever the
   * board's runtimes or services change; what is remembered of a service that
   * is still there is kept.
   */
  attach(
    runtimes: RuntimeDescriptor[],
    services: { [runtimeId: string]: ServiceDescriptor[] | undefined },
    scopes: { [runtimeId: string]: RuntimeScope | undefined },
  ): () => void {
    this.detach();
    const present = new Set<string>();
    for (const runtime of runtimes) {
      const app = scopes[runtime.id]?.getApp?.() as any;
      for (const service of services[runtime.id] ?? []) {
        const key = keyOf(runtime.id, service.uuid);
        present.add(key);
        if (!app?.registerNotificationTarget) {
          continue;
        }
        const target = { uuid: service.uuid };
        const callback = (notification: any) =>
          this.onNotification(key, notification);
        app.registerNotificationTarget(target, callback);
        this.registrations.push({ app, target, callback });
      }
    }
    for (const key of [...this.flows.keys()]) {
      if (!present.has(key)) {
        this.flows.delete(key);
      }
    }
    return () => this.detach();
  }

  detach() {
    for (const { app, target, callback } of this.registrations) {
      app.unregisterNotificationTarget?.(target, callback);
    }
    this.registrations = [];
  }

  flowOf(runtimeId: string, uuid: string): ServiceFlow {
    return this.flows.get(keyOf(runtimeId, uuid)) ?? EMPTY;
  }

  /** Forgets one side of what a service did; the next value starts afresh. */
  clear(runtimeId: string, uuid: string, side: FlowSide) {
    const key = keyOf(runtimeId, uuid);
    const flow = this.flows.get(key);
    if (flow) {
      this.setFlow(key, { ...flow, [side]: [] });
    }
  }

  /** Calls `listener` when what a service did changes; returns how to stop. */
  subscribe(runtimeId: string, uuid: string, listener: () => void) {
    return listen(this.flowListeners, keyOf(runtimeId, uuid), listener);
  }

  /** Calls `listener` with every call report a service sends. */
  onCall(
    runtimeId: string,
    uuid: string,
    listener: (reading: CallReading) => void,
  ) {
    return listen(this.callListeners, keyOf(runtimeId, uuid), listener);
  }

  private onNotification(key: string, notification: any) {
    const reading = readCallReport(notification);
    if (!reading) {
      return;
    }
    for (const listener of [...(this.callListeners.get(key) ?? [])]) {
      listener(reading);
    }
    const flow = this.flows.get(key) ?? EMPTY;
    if (reading.phase === "start" && reading.input) {
      this.setFlow(key, {
        ...flow,
        input: rememberFlow(flow.input, reading.input.data),
      });
    } else if (reading.phase === "finish" && reading.output) {
      this.setFlow(key, {
        ...flow,
        output: rememberFlow(flow.output, reading.output.data),
      });
    }
  }

  private setFlow(key: string, flow: ServiceFlow) {
    this.flows.set(key, flow);
    for (const listener of [...(this.flowListeners.get(key) ?? [])]) {
      listener();
    }
  }
}

function listen<T>(
  listeners: Map<string, Set<T>>,
  key: string,
  listener: T,
): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export const BoardFlowContext = createContext<BoardFlow | null>(null);

/** What a service received and passed on, kept current. */
export function useServiceFlow(
  runtimeId: string | undefined,
  uuid: string | undefined,
): ServiceFlow {
  const flow = useContext(BoardFlowContext);
  const subscribe = useCallback(
    (listener: () => void) =>
      flow && runtimeId && uuid
        ? flow.subscribe(runtimeId, uuid, listener)
        : () => {},
    [flow, runtimeId, uuid],
  );
  return useSyncExternalStore(subscribe, () =>
    flow && runtimeId && uuid ? flow.flowOf(runtimeId, uuid) : EMPTY,
  );
}

/**
 * Whether a service is running, as the desktop's frame shows it
 * (`processingSweep`): tinted for as long as a run lasts, with one crossing of
 * the bar for every run that starts.
 */
export function useServiceActivity(runtimeId: string, uuid: string) {
  const flow = useContext(BoardFlowContext);
  const sweep = useProcessingSweep();
  const { start, finish } = sweep;
  useEffect(
    () =>
      flow?.onCall(runtimeId, uuid, (reading) =>
        reading.phase === "start" ? start(reading.call) : finish(reading.call),
      ),
    [flow, runtimeId, uuid, start, finish],
  );
  return sweep;
}
