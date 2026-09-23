import { useEffect, useRef, useState } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { findService } from "./boardServices";

/**
 * Listening to what a service says.
 *
 * Two steps stand between a facade and a service's news, and both are the same
 * for everything that listens — a widget drawing a value, a notice raising a
 * toast. Finding the service is the first: a browser service is appended into
 * its runtime scope by mutation, possibly after the facade is already on
 * screen, so a single lookup can miss one that is on its way and would never
 * run again. Subscribing is the second, and it has to survive the caller
 * re-rendering with a new closure without tearing the subscription down.
 *
 * Kept apart from the widgets so that listening is not a thing only widgets can
 * do: a notice has no layout at all and reads a service exactly as a widget
 * does.
 */

export type ResolvedService = ReturnType<typeof findService>;

// Enable with: localStorage.setItem("hkp-facade-debug", "1") + reload.
export function facadeDebugLog(...args: unknown[]) {
  if (localStorage.getItem("hkp-facade-debug") === "1") {
    console.log("[facade-source]", ...args);
  }
}

/** What a lookup has come to: nothing asked for, still looking, found, or
 *  looked for long enough that not finding it is the answer. */
export type ServiceResolution = "idle" | "pending" | "resolved" | "missing";

/**
 * How long a uuid goes unanswered before the lookup stops calling it late and
 * starts calling it wrong. Generous, because a remote runtime connecting and a
 * sub-service being built are both legitimately slow — and a uuid that is
 * simply spelled wrong is in no hurry, so waiting costs it nothing.
 */
const MISSING_AFTER_MS = 5000;

/** Before the deadline, often — a service that is one tick late should not look
 *  late. After it, rarely: the answer is no longer expected to change, but a
 *  service is appended into its scope by mutation and may still arrive, so it
 *  becomes a slower question rather than a last one. */
const POLL_MS = 250;
const SLOW_POLL_MS = 1000;

type Lookup = {
  /** The uuids that resolved. The rest are pending, or listed in `missing`. */
  services: Record<string, NonNullable<ResolvedService>>;
  /** Uuids still unfound past the deadline, in the order they were asked for. */
  missing: string[];
};

const NOTHING: Lookup = { services: {}, missing: [] };

function sameLookup(a: Lookup, b: Lookup): boolean {
  const found = Object.keys(a.services);
  if (found.length !== Object.keys(b.services).length) {
    return false;
  }
  for (const uuid of found) {
    if (a.services[uuid] !== b.services[uuid]) {
      return false;
    }
  }
  return (
    a.missing.length === b.missing.length &&
    a.missing.every((uuid, index) => uuid === b.missing[index])
  );
}

/**
 * Looks for services until they are found, and says which ones never were.
 *
 * Polling has no end of its own: the scopes a service is appended into are
 * mutated in place, so nothing reliably tells this hook to look again. The
 * deadline is therefore not a point at which it gives up, only the point at
 * which it stops assuming the board is still assembling itself and starts
 * saying so — a uuid that turns up afterwards resolves normally and the report
 * goes away with it. Without that, a uuid nobody ever spelled correctly is
 * indistinguishable from one that is on its way, forever.
 */
function useLookup(boardContext: BoardContextState, uuids: string[]): Lookup {
  // The dependency, rather than the array: callers rebuild it on every render,
  // and what the lookup is about is which uuids are in it.
  const key = uuids.join("\n");
  const [lookup, setLookup] = useState<Lookup>(NOTHING);
  // When each uuid was first looked for. Held outside the effect because the
  // effect restarts whenever the board's services change — which, on a board
  // still loading, is exactly when it changes most — and a deadline measured
  // from the latest restart would keep being pushed out and never arrive.
  const startedRef = useRef<Record<string, number>>({});
  // What has already been said about each uuid, so that a poll running for as
  // long as a board is open reports each answer once rather than every tick.
  const reportedRef = useRef<Record<string, ServiceResolution>>({});

  useEffect(() => {
    if (!key) {
      setLookup((prev) => (prev === NOTHING ? prev : NOTHING));
      return;
    }
    const wanted = key.split("\n");
    for (const uuid of wanted) {
      if (startedRef.current[uuid] === undefined) {
        startedRef.current[uuid] = Date.now();
      }
    }

    const report = (
      uuid: string,
      status: ServiceResolution,
      service?: unknown,
    ) => {
      if (reportedRef.current[uuid] === status) {
        return;
      }
      const first = reportedRef.current[uuid] === undefined;
      reportedRef.current[uuid] = status;
      if (status === "missing") {
        // Not behind the debug flag. Past the deadline this is no longer a
        // trace of a board loading, it is something a builder has to fix, and
        // a facade that keeps quiet about it looks like one that works.
        console.warn(
          `[facade] no service "${uuid}" on this board — nothing will be drawn from it`,
        );
        return;
      }
      if (status === "pending") {
        facadeDebugLog(uuid, "not found yet — polling");
        return;
      }
      facadeDebugLog(
        uuid,
        first ? "resolved immediately" : "resolved by polling",
        service,
      );
    };

    let timer: ReturnType<typeof setTimeout> | undefined;

    // One pass over everything wanted, and what is left of it: `pending` says
    // something may still be on its way, which is what decides how soon to ask
    // again; nothing pending and nothing missing means there is no question
    // left to ask.
    const scan = (): { pending: boolean; missing: boolean } => {
      const next: Lookup = { services: {}, missing: [] };
      let pending = false;
      for (const uuid of wanted) {
        const svc = findService(boardContext, uuid);
        if (svc) {
          next.services[uuid] = svc;
          report(uuid, "resolved", svc);
          continue;
        }
        if (Date.now() - startedRef.current[uuid] >= MISSING_AFTER_MS) {
          next.missing.push(uuid);
          report(uuid, "missing");
          continue;
        }
        pending = true;
        report(uuid, "pending");
      }
      setLookup((prev) => (sameLookup(prev, next) ? prev : next));
      return { pending, missing: next.missing.length > 0 };
    };

    const tick = () => {
      const left = scan();
      if (!left.pending && !left.missing) {
        return;
      }
      timer = setTimeout(tick, left.pending ? POLL_MS : SLOW_POLL_MS);
    };
    tick();

    return () => clearTimeout(timer);
  }, [key, boardContext.scopes, boardContext.services]);

  return lookup;
}

/**
 * The service with this uuid, once the board has one. Polls until it appears,
 * because a service may be built after whatever is waiting for it mounted.
 */
export function useResolvedService(
  boardContext: BoardContextState,
  serviceUuid: string | undefined,
): ResolvedService {
  const { services } = useLookup(
    boardContext,
    serviceUuid ? [serviceUuid] : [],
  );
  return (serviceUuid ? services[serviceUuid] : null) ?? null;
}

/**
 * Which of these uuids the board turned out not to have — empty while any of
 * them may still be on its way, so that a widget shows a fault rather than the
 * ordinary wait every board goes through on load.
 */
export function useMissingServices(
  boardContext: BoardContextState,
  uuids: string[],
): string[] {
  return useLookup(boardContext, uuids).missing;
}

/**
 * Calls `onNotification` with everything the service reports, for as long as
 * the caller is mounted.
 *
 * The handler is held in a ref rather than named as a dependency: a caller that
 * rebuilds its closure on every render would otherwise unsubscribe and
 * resubscribe on every render, and a notification arriving in between would be
 * heard by nobody.
 */
export function useServiceNotifications(
  service: ResolvedService,
  onNotification: (notification: any) => void,
): void {
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;

  useEffect(() => {
    const app = service?.app;
    if (!service || !app?.registerNotificationTarget) {
      if (service) {
        facadeDebugLog(service.uuid, "app has NO registerNotificationTarget", app);
      }
      return;
    }
    const handler = (notification: any) => {
      // Machinery talking to itself. A facade has no use for it, and a widget
      // that treated it as news would redraw from a state echo.
      if (notification?.__internal) {
        return;
      }
      handlerRef.current(notification);
    };
    facadeDebugLog(service.uuid, "subscribed");
    app.registerNotificationTarget(service, handler);
    return () => {
      app.unregisterNotificationTarget?.(service, handler);
    };
  }, [service]);
}
