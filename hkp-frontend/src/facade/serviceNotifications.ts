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

/**
 * The service with this uuid, once the board has one. Polls until it appears,
 * because a service may be built after whatever is waiting for it mounted.
 */
export function useResolvedService(
  boardContext: BoardContextState,
  serviceUuid: string | undefined,
): ResolvedService {
  const [service, setService] = useState<ResolvedService>(null);

  useEffect(() => {
    if (!serviceUuid) {
      setService(null);
      return;
    }
    const found = findService(boardContext, serviceUuid);
    if (found) {
      facadeDebugLog(serviceUuid, "resolved immediately", found);
      setService(found);
      return;
    }
    facadeDebugLog(serviceUuid, "not found yet — polling");
    const timer = setInterval(() => {
      const svc = findService(boardContext, serviceUuid);
      if (svc) {
        facadeDebugLog(serviceUuid, "resolved by polling", svc);
        setService(svc);
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [boardContext.scopes, boardContext.services, serviceUuid]);

  return service;
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
