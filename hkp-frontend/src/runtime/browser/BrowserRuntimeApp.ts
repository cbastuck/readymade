import React from "react";
import { findServiceUI } from "./UIRegistry";
import {
  AppImpl,
  InstanceId,
  LogLevel,
  NextOptions,
  ProcessContext,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceInstance,
} from "../../types";
import { appendSubservice } from "./BrowserRuntimeApi";
import BrowserRuntimeScope from "./BrowserRuntimeScope";
import {
  mintTokenViaPlatform,
  RuntimeTokenRequest,
} from "hkp-frontend/src/platform/PlatformContext";
import NotificationTargets from "../NotificationsTargets";
import { onServiceProcess, onServiceResult } from "../serviceState";
import { boardRun, personRun, runExpired } from "../processContext";

export function createBrowserRuntimeApp(scope: BrowserRuntimeScope): AppImpl {
  const notificationTargets = new NotificationTargets();
  const boardVariables: Record<string, any> = {};
  const interactiveServices = new WeakMap<object, ServiceInstance>();

  const reportAndContinue = (
    svc: InstanceId | null,
    result: any,
    options: NextOptions | undefined,
    run: ProcessContext,
  ) => {
    // The loop in scope.next only reports the services it calls, and this one
    // is not among them: it emitted on its own. A replay is the case with
    // nothing to report because the value came from outside.
    if (svc && !options?.replay) {
      onServiceProcess(app, svc, undefined);
      onServiceResult(app, svc, result);
    }
    return scope.next(svc, result, run);
  };

  const captureAnswer = (svc: InstanceId, run: ProcessContext) => {
    scope.defer(run);
    let pending = true;
    return (result: any) => {
      if (!pending) {
        return;
      }
      pending = false;
      scope.resume(run);
      if (!runExpired(run)) {
        void scope.next(svc, result, run);
      }
    };
  };

  const app: AppImpl = {
    getAuthenticatedUser: () => scope.signedInUser(),

    // Backed by the module-level platform bridge (set by PlatformProvider at the
    // app root), so it works regardless of when this app was constructed or
    // whether the runtime's UI component has rendered. Null on plain web.
    mintToken: (request: RuntimeTokenRequest): Promise<string | null> =>
      mintTokenViaPlatform(request),
    next: (svc: InstanceId | null, result: any, options?: NextOptions) => {
      // Continue the run while the emitting service is still inside one. A
      // timer or standing subscription that speaks outside an active call
      // begins a board-origin run. Interactive controls enter their person run
      // through serviceForUserInterface below. A one-shot answer that belongs
      // to an earlier call uses defer() below instead.
      const active = svc ? scope.contextOf(svc) : undefined;
      return reportAndContinue(svc, result, options, active ?? boardRun());
    },

    defer: (svc: InstanceId) =>
      captureAnswer(svc, scope.contextOf(svc) ?? boardRun()),

    serviceForUserInterface: (service: ServiceInstance) => {
      const known = interactiveServices.get(service);
      if (known) {
        return known;
      }

      type ServiceMethod = (...args: any[]) => any;
      const methods = new Map<
        PropertyKey,
        { source: ServiceMethod; routed: ServiceMethod }
      >();
      const personCall = <T,>(call: () => T): T =>
        scope.callInContext(service, personRun(scope.signedInUser()), call);

      // A few panels emit through service.app directly instead of calling a
      // service method. Give those calls the same API boundary as methods on
      // the service handle. Other app operations remain the real runtime app.
      const interactiveApp = new Proxy(app, {
        get(target, property, receiver) {
          if (property === "next") {
            return (
              svc: InstanceId | null,
              result: any,
              options?: NextOptions,
            ) =>
              reportAndContinue(
                svc,
                result,
                options,
                personRun(scope.signedInUser()),
              );
          }
          if (property === "defer") {
            return (svc: InstanceId) =>
              captureAnswer(svc, personRun(scope.signedInUser()));
          }
          if (property === "log" || property === "configureService") {
            const member = Reflect.get(target, property, target);
            if (typeof member !== "function") {
              return member;
            }
            return (...args: any[]) =>
              personCall(() => Reflect.apply(member, target, args));
          }
          return Reflect.get(target, property, receiver);
        },
      });

      const routed = new Proxy(service, {
        get(target, property) {
          if (property === "app") {
            return interactiveApp;
          }
          const member = Reflect.get(target, property, target);
          if (typeof member !== "function") {
            return member;
          }
          const method = member as ServiceMethod;
          const cached = methods.get(property);
          if (cached && cached.source === method) {
            return cached.routed;
          }
          const call = (...args: any[]) =>
            personCall(() => Reflect.apply(method, target, args));
          methods.set(property, { source: method, routed: call });
          return call;
        },
        set(target, property, value) {
          return Reflect.set(target, property, value, target);
        },
      });
      interactiveServices.set(service, routed);
      return routed;
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

    log: (
      service: InstanceId,
      level: LogLevel,
      event: string,
      data?: any,
    ) => {
      scope.log(service, level, event, data);
    },

    currentContext: (service: InstanceId) => scope.contextOf(service),

    callInRun: (
      target: ServiceInstance,
      params: any,
      run: ProcessContext | null | undefined,
    ) => scope.processIn(target, params, run),

    configureInRun: async (
      target: ServiceInstance,
      config: any,
      run: ProcessContext | null | undefined,
    ) =>
      run
        ? scope.callInContext(target, run, () => target.configure(config))
        : target.configure(config),

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
        service: app.serviceForUserInterface?.(ssvc) ?? ssvc,
        onServiceAction: () => {
          console.warn("No service actions available for sub services");
        },
      });
    },
    /**
     * The cells this service holds values in between passes.
     *
     * Reached through the app because a browser service has no host of its
     * own: `this.app` is the whole of what it can ask. Which cells those are
     * is the scope's to decide — its own, or the ones a scope around it
     * lent it — so a service names a slot and never a store.
     */
    slots: () => scope.slots(),
    getRuntimeVariable: () => boardVariables,
    setRuntimeVariable: (key: string, value: any) => {
      boardVariables[key] = value;
    },
    listAvailableServices: () => scope.registry.allowedServices(),
    processRuntimeByName: (name: string, params: any) =>
      scope?.processRuntimeByName(name, params),
    configureServiceInRuntime: (
      runtimeId: string,
      serviceUuid: string,
      config: any,
      run?: ProcessContext | null,
    ) => scope.configureServiceInRuntime(runtimeId, serviceUuid, config, run),
    get coordinator() {
      // Read through, not captured: the host assigns the coordinator after the
      // scope exists, and a board can be torn down under a live service.
      return scope.coordinator ?? undefined;
    },
    // Read through for the same reason: an asset edited while the board runs
    // is what a service resolving it next should see.
    assets: () => scope.assets?.() ?? [],
  };

  return app;
}

function serviceDataKey(uuid: string, key: string) {
  return `service-data-${uuid}-${key}`;
}
