import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceImpl,
  ServiceInstance,
} from "@/types";
import RealtimeRuntimeScope from "./RealtimeRuntimeScope";
import { ReactElement } from "react";
import NotificationTargets from "../NotificationsTargets";

export function createRealtimeRuntimeApp(scope: RealtimeRuntimeScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  return {
    getAuthenticatedUser: () => scope.authenticatedUser,
    notify: (_service: InstanceId, _notification: any): void => {
      notificationTargets.notify(_service, _notification);
    },
    next: (_svc: InstanceId | null, _result: any): void => {},
    getServiceById: (uuid: string): ServiceImpl | null => {
      return { uuid } as any; // TODO:  see above, mabye we don't need this at all
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
  };
}
