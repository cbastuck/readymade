import {
  AppImpl,
  InstanceId,
  RestoreRuntimeResult,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
  User,
} from "hkp-frontend/src/types";
import { createRuntimeRestApp } from "hkp-frontend/src/runtime/rest/RuntimeRestApp";
import type RuntimeRestScope from "hkp-frontend/src/runtime/rest/RuntimeRestScope";
import { CoordinatorSnapshotStore } from "./coordinatorSnapshot";

/**
 * Reaching a cloud board's runtimes through its coordinator.
 *
 * A board attached this way is owned by the coordinator: it provisioned the
 * runtimes and holds their state, and this browser is a viewer. So nothing here
 * dials a runtime — which is the point, since a cloud board's runtimes may live
 * where the browser has no route to them. Reads come from the snapshot the
 * coordinator pushes; a configure is a request over the same bridge socket.
 *
 * Structural edits are absent on purpose. Adding or removing services means
 * owning the board, and a board is owned where it is built: the playground.
 * Changing a deployed board is changing it there and deploying it again.
 */

export type CoordinatorBridgeAccess = {
  snapshot: CoordinatorSnapshotStore;
  configureRemoteService: (
    runtimeId: string,
    serviceUuid: string,
    config: unknown,
  ) => Promise<unknown>;
};

function notWhileAttached(what: string): never {
  throw new Error(
    `Cannot ${what} on a deployed board — its coordinator owns it. Change the board in the playground and deploy it again.`,
  );
}

/**
 * A scope for a runtime this browser does not own. It opens no socket: the one
 * bridge socket already carries every runtime's state, so a per-runtime
 * connection would only duplicate it — and would need a route to the runtime.
 */
class CoordinatorRuntimeScope implements RuntimeScope {
  descriptor: RuntimeDescriptor;
  authenticatedUser: User | null;
  registry: ServiceRegistry = [];
  onResult: RuntimeScope["onResult"] = async () => {};
  onConfig?: (instanceId: string, config: object) => void;
  onAction: (action: ServiceAction) => boolean = () => false;

  private readonly appImpl: AppImpl;

  constructor(
    runtime: RuntimeDescriptor,
    user: User | null,
    private readonly bridge: CoordinatorBridgeAccess,
    private readonly api: RuntimeApi,
  ) {
    this.descriptor = runtime;
    this.authenticatedUser = user;
    // The same app a REST runtime's services get: it owns the notification
    // targets panels register with, and reads the registry off this scope. Only
    // where the data comes from differs — the bridge rather than a socket of
    // our own.
    this.appImpl = createRuntimeRestApp(this as unknown as RuntimeRestScope);
  }

  getApi(): RuntimeApi {
    return this.api;
  }

  getApp(): AppImpl {
    return this.appImpl;
  }

  /**
   * Delivers a notification the coordinator forwarded, exactly as a runtime's
   * own socket would. Service panels register for these; a Monitor renders
   * nothing without them, since its output is not part of its state.
   */
  notify(serviceUuid: string, payload: unknown): void {
    this.appImpl.notify({ uuid: serviceUuid }, payload);
  }

  /** Whatever the coordinator last said this service reported. */
  stateOf(serviceUuid: string): unknown {
    return this.bridge.snapshot.getServiceState(
      this.descriptor.id,
      serviceUuid,
    );
  }

  async close(): Promise<void> {
    // Nothing to close: no socket of its own, and the runtime keeps running —
    // it belongs to the coordinator, not to this view.
  }
}

export function createBridgeRuntimeApi(
  bridge: CoordinatorBridgeAccess,
): RuntimeApi {
  const api: RuntimeApi = {
    /**
     * Builds the scope from what the coordinator reported. No `POST /runtimes`:
     * attaching must never provision, or the browser would be a second owner of
     * a board that already has one.
     */
    restoreRuntime: async (
      runtime: RuntimeDescriptor,
      services: Array<ServiceDescriptor>,
      user: User | null,
    ): Promise<RestoreRuntimeResult | null> => {
      const scope = new CoordinatorRuntimeScope(runtime, user, bridge, api);
      const registry = bridge.snapshot.getRegistry(
        runtime.id,
      ) as ServiceRegistry;
      scope.registry = registry;

      // The board says which services exist and in what order; the coordinator
      // says what each of them currently reports. Neither alone is enough: a
      // saved board cannot carry an address assigned at provision time, and the
      // snapshot does not carry the order services run in.
      const live = bridge.snapshot.getServices(runtime.id);
      const restored = (services ?? []).map((svc) => ({
        ...svc,
        state: svc.uuid in live ? live[svc.uuid] : (svc as { state?: unknown }).state,
      })) as Array<ServiceDescriptor>;

      return { runtime, services: restored, scope, registry };
    },

    configureService: async (
      scope: RuntimeScope,
      service: InstanceId,
      config: unknown,
    ) => {
      const state = await bridge.configureRemoteService(
        scope.descriptor.id,
        service.uuid,
        config,
      );
      // Same contract as the REST api: hand the new state back to the panel so
      // it can reconcile what it optimistically showed.
      scope.onConfig?.(service.uuid, { state } as object);
      return state;
    },

    getServiceConfig: async (scope: RuntimeScope, service: InstanceId) =>
      bridge.snapshot.getServiceState(scope.descriptor.id, service.uuid),

    removeRuntime: async (scope: RuntimeScope) => {
      // Leaving the view does not stop the board; the runtime is the
      // coordinator's and outlives this browser.
      await scope.close?.();
    },

    processRuntime: async () =>
      notWhileAttached("run a runtime"),
    addRuntime: async () => notWhileAttached("add a runtime"),
    addService: async (_scope: RuntimeScope, _service: ServiceClass) =>
      notWhileAttached("add a service"),
    removeService: async () => notWhileAttached("remove a service"),
    processService: async () => notWhileAttached("run a service"),
    rearrangeServices: async () => notWhileAttached("reorder services"),
  };

  return api;
}
