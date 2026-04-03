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
    notify: (service: InstanceId, notification: any): void => {
      notificationTargets.notify(service, notification);
    },
    next: (svc: InstanceId | null, result: any): void => {
      // scope.onResult(svc?.uuid || null, result);
      scope.getApi().processRuntime(
        scope,
        result,
        svc,
        null, // we don't have a service here, so we pass null
      );
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
  };
}
