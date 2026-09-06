import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceInstance,
} from "hkp-frontend/src/types";
import RuntimeRestScope from "./RuntimeRestScope";
import { ReactElement } from "react";
import NotificationTargets from "../NotificationsTargets";

export function createRuntimeRestApp(scope: RuntimeRestScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  return {
    getAuthenticatedUser: () => scope.authenticatedUser,
    // A remote runtime records its own entries and carries them to the board's
    // coordinator over its own connection; this side only proxies a view of it,
    // so there is nothing here to record.
    log: () => {},

    notify: (service: InstanceId, notification: any): void => {
      notificationTargets.notify(service, notification);
    },
    /**
     * Emits `result` as if `svc` had just produced it: the services after `svc`
     * run, `svc` itself and everything before it does not.
     *
     * The runtime endpoint this used to call always starts at the first service,
     * so a value pushed from the middle of a pipeline was re-run through the
     * whole of it — the services before the caller would overwrite it long
     * before the one after the caller ever saw it.
     *
     * `NextOptions.replay` has nothing to answer here: this app belongs to the
     * panels, not to the services, so every call through it is already a replay.
     * A remote service emitting on its own never reaches this — it calls
     * `processFrom` on its own host, which reports it there.
     */
    next: (svc: InstanceId | null, result: any): void => {
      const api = scope.getApi();
      if (!svc) {
        // No origin service: this is the pipeline's own entry point.
        api.processRuntime(scope, result, null, null);
        return;
      }

      const position = scope.services.findIndex((s) => s.uuid === svc.uuid);
      if (position === -1) {
        console.warn(
          `RuntimeRestApp.next: service ${svc.uuid} is not in runtime ${scope.descriptor.id}`,
        );
        api.processRuntime(scope, result, svc, null);
        return;
      }

      const successor = scope.services[position + 1];
      if (!successor) {
        // Nothing follows in this runtime, so the result leaves it.
        scope.onResult(svc.uuid, result, null);
        return;
      }

      api.processService(scope, successor, result, null).catch((err) => {
        console.error("RuntimeRestApp.next", err);
      });
    },
    getServiceById: (_uuid: string): ServiceInstance | null => {
      return null;
    },
    sendAction: (action: ServiceAction) => {
      scope.onAction(action); // just forward
    },
    storeServiceData: (
      _serviceUuid: string,
      _key: string,
      _value: string,
    ): void => {},
    restoreServiceData: (
      _serviceUuid: string,
      _key: string,
    ): string | undefined => {
      return undefined;
    },
    removeServiceData: (_serviceUuid: string, _key: string): void => {},
    createSubService: (
      _parent: ServiceInstance,
      _service: ServiceClass,
      _instanceId?: string,
    ): Promise<ServiceInstance | null> => {
      return Promise.resolve(null);
    },
    createSubServiceUI: (_svc: ServiceInstance): ReactElement | null => {
      return null;
    },
    listAvailableServices: () => scope.registry,
    registerNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (notification: any) => void,
    ) => {
      notificationTargets.register(svc, onNotification);
    },
    unregisterNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (notification: any) => void,
    ) => {
      notificationTargets.unregister(svc, onNotification);
    },
    getRuntimeVariable: () => ({}),
    setRuntimeVariable: (_key: string, _value: any) => {},
  };
}
