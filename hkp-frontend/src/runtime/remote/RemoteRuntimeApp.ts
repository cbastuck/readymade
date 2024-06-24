import { ReactElement } from "react";
import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceImpl,
  ServiceInstance,
} from "../../types";
import RemoteRuntimeScope from "./RemoteRuntimeScope";

import NotificationTargets from "../NotificationsTargets";

export function createRemoteRuntimeApp(scope: RemoteRuntimeScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  return {
    getAuthenticatedUser: () => scope.authenticatedUser,
    registerNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (notification: any) => void
    ) => {
      notificationTargets.register(svc, onNotification);
    },

    unregisterNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (notification: any) => void
    ) => {
      notificationTargets.unregister(svc, onNotification);
    },
    notify: (service: InstanceId, notification: any): void => {
      // TODO: the type of first parameter is bad
      if (!notificationTargets.hasCallbacks(service)) {
        console.warn("BrowserRuntimeApp.notify no targets for", service.uuid);
        return;
      }

      notificationTargets.notify(service, notification);
    },
    next: (_svc: InstanceId | null, _result: any): void => {},
    getServiceById: (uuid: string): ServiceImpl | null => {
      return { uuid } as any; // TODO:  see above, mabye we don't need this at all for the remote case
    },
    sendAction: (action: ServiceAction) => {
      scope.onAction(action); // just forward
    },
    storeServiceData: (
      _serviceUuid: string,
      _key: string,
      _value: string
    ): void => {},
    restoreServiceData: (
      _serviceUuid: string,
      _key: string
    ): string | undefined => {
      return undefined;
    },
    removeServiceData: (_serviceUuid: string, _key: string): void => {},
    createSubService: (
      _parent: ServiceImpl,
      _service: ServiceClass,
      _instanceId?: string
    ): Promise<ServiceInstance | null> => {
      return Promise.resolve(null);
    },
    createSubServiceUI: (_svc: ServiceImpl): ReactElement | null => {
      return null;
    },
    listAvailableServices: () => [],
  };
}
