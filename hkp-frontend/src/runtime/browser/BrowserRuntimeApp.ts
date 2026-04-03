import React from "react";
import { findServiceUI } from "./UIRegistry";
import {
  AppImpl,
  InstanceId,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceInstance,
} from "../../types";
import { appendSubservice } from "./BrowserRuntimeApi";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import NotificationTargets from "../NotificationsTargets";
import { onServiceProcess, onServiceResult } from "../serviceState";

export function createBrowserRuntimeApp(scope: BrowserRuntimeScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  const app = {
    getAuthenticatedUser: () => scope.authenticatedUser,
    next: (svc: InstanceId | null, result: any) => {
      if (svc) {
        onServiceProcess(app, svc, undefined);
        onServiceResult(app, svc, result);
      }

      return scope.next(svc, result);
    },

    getServiceById: (instanceId: string) =>
      scope.findServiceInstance(instanceId)?.[0] || null,

    sendAction: (action: ServiceAction) => {
      if (scope.onAction(action)) {
        return; // the action was handled
      }

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

    configureService: (svc: ServiceDescriptor, config: any) =>
      (svc as ServiceInstance).configure(config),

    notify: (service: InstanceId, notification: any) => {
      if (!notificationTargets.hasCallbacks(service)) {
        // console.warn("BrowserRuntimeApp.notify no targets for", service.uuid);
        return;
      }

      notificationTargets.notify(service, notification);
    },

    createSubService: (
      parent: ServiceInstance,
      service: ServiceClass,
      instanceId?: string,
    ): Promise<ServiceInstance | null> =>
      appendSubservice(scope, service, parent, instanceId),

    createSubServiceUI: (svc: InstanceId) => {
      const ssvc = scope.getSubservice(svc.uuid);
      if (!ssvc) {
        throw new Error("createSubServiceUI failed - subservice not found");
      }
      const serviceId = ssvc.serviceId || ssvc.__descriptor?.serviceId;
      const ui = serviceId && findServiceUI(serviceId);
      return React.createElement(ui || "div", {
        resizable: false,
        frameless: true,
        service: ssvc,
        onServiceAction: () => {
          console.warn("No service actions available for sub services");
        },
      });
    },
    listAvailableServices: () => scope.registry.allowedServices(),
    processRuntimeByName: (name: string, params: any) =>
      scope?.processRuntimeByName(name, params),
  };

  return app;
}

function serviceDataKey(uuid: string, key: string) {
  return `service-data-${uuid}-${key}`;
}
