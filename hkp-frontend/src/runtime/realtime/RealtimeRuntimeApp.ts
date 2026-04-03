import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceImpl,
  ServiceInstance,
} from "hkp-frontend/src/types";
import RealtimeRuntimeScope from "./RealtimeRuntimeScope";
import { ReactElement } from "react";
import NotificationTargets from "../NotificationsTargets";

export function createRealtimeRuntimeApp(scope: RealtimeRuntimeScope): AppImpl {
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
    getServiceById: (uuid: string): ServiceImpl | null => {
      return { uuid } as any; // TODO:  see above, mabye we don't need this at all
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
      _parent: ServiceImpl,
      _service: ServiceClass,
      _instanceId?: string,
    ): Promise<ServiceInstance | null> => {
      return Promise.resolve(null);
    },
    createSubServiceUI: (_svc: ServiceImpl): ReactElement | null => {
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
