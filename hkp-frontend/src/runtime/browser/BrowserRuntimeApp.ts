import { createServiceUI } from "../../UIFactory";
import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceImpl,
  ServiceInstance,
} from "../../types";
import { appendSubservice } from "./BrowserRuntimeApi";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import NotificationTargets from "./NotificationsTargets";

export function createBrowserRuntimeApp(scope: BrowserRuntimeScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  return {
    getAuthenticatedUser: () => scope.authenticatedUser,
    next: (svc: InstanceId | null, result: any) => {
      return scope.next(svc, result);
    },

    getServiceById: (instanceId: string) =>
      scope.findServiceInstance(instanceId)?.[0] || null,

    sendAction: (action: ServiceAction) => {
      // the sandbox for example registers a listener
      // for these kind of actions
      const target: any = window.frameElement;
      if (target && target.onAction) {
        target.onAction(action);
      }
    },

    storeServiceData: (serviceUuid: string, key: string, value: string) => {
      localStorage.setItem(serviceDataKey(serviceUuid, key), value);
    },

    restoreServiceData: (serviceUuid: string, key: string) => {
      return (
        localStorage.getItem(serviceDataKey(serviceUuid, key)) || undefined
      );
    },

    removeServiceData: (serviceUuid: string, key: string) => {
      localStorage.removeItem(serviceDataKey(serviceUuid, key));
    },

    registerNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (svc: ServiceInstance, notification: any) => void
    ) => {
      notificationTargets.register(svc, onNotification);
    },

    unregisterNotificationTarget: (
      svc: ServiceInstance,
      onNotification: (svc: ServiceInstance, notification: any) => void
    ) => {
      notificationTargets.unregister(svc, onNotification);
    },

    configureService: (svc: ServiceDescriptor, config: any) =>
      (svc as ServiceImpl).configure(config),

    notify: (service: ServiceInstance, notification: any) => {
      if (!notificationTargets.hasCallbacks(service)) {
        console.warn(
          "BrowserRuntimeApp.notify no targets for",
          service.uuid,
          service.__descriptor?.serviceName
        );
        return;
      }
      notificationTargets.notify(service, notification);
    },

    createSubService: (
      parent: ServiceImpl,
      service: ServiceClass,
      instanceId?: string
    ) => appendSubservice(scope, service, parent, instanceId),

    createSubServiceUI: (svc: ServiceImpl) =>
      createServiceUI(
        scope,
        "deprecated board name",
        svc,
        scope.descriptor.id,
        "deprecated userId",
        {
          resizable: false,
        }
      ),
    listAvailableServices: () => scope.registry.allowedServices(),
  };
}

function serviceDataKey(uuid: string, key: string) {
  return `service-data-${uuid}-${key}`;
}
