import {
  AppImpl,
  InstanceId,
  LogEntry,
  LogLevel,
  ProcessContext,
  RuntimeApi,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
  User,
} from "../../types";
import { BoardCoordinator } from "hkp-frontend/src/core/coordinator";
import { AssetsSource } from "hkp-frontend/src/runtime/board/assets";
import BrowserRegistry from "./BrowserRegistry";
import { createBrowserRuntimeApp } from "./BrowserRuntimeApp";
import api from "./BrowserRuntimeApi";
import { onServiceProcess, onServiceResult } from "../serviceState";
import { createSlotStore, SlotStore } from "../slots";
import { runExpired } from "../processContext";

export type InstanceIndexTuple = [ServiceInstance | null, number];

export default class BrowserRuntimeScope implements RuntimeScope {
  descriptor: RuntimeDescriptor;
  serviceInstances: Array<ServiceInstance>;
  subservices: {
    [uuid: string]: { service: ServiceInstance; parent: ServiceInstance };
  };
  app: AppImpl;
  registry: BrowserRegistry;
  authenticatedUser: User | null = null;
  isDisposing: boolean = false;
  /**
   * Which passes are still wanted: each pass remembers the value it started
   * under, and one that finds it changed ends where it is. See cancelInFlight.
   */
  private passGeneration = 0;
  state: { [key: string]: any } = {};
  /**
   * The runs each service is currently being called in, keyed by service uuid.
   *
   * Kept per service rather than one value for the whole scope, because this
   * runtime's pass awaits: two calls can be in flight at once and a single
   * ambient value would hand one call's run to the other. More than one entry
   * for a service is kept rather than overwritten: if concurrent calls emit
   * while their origins are ambiguous, `contextOf` fails closed instead of
   * assigning one person's output to the other.
   */
  private serviceContexts = new Map<string, ProcessContext[]>();
  /** Number of explicit late answers still outstanding in each run. */
  private deferredRuns = new Map<ProcessContext, number>();
  private logTargets = new Set<(entry: LogEntry) => void>();
  /**
   * Whether entries may carry their `data` payload. Off unless a board turns it
   * on: `data` is the one free-form field and so the only place a service can
   * record something it did not mean to.
   */
  private logData = false;
  /**
   * The cells services in this scope hold values in between passes.
   *
   * Owned rather than delegated by default: a runtime is the outermost thing a
   * slot name can mean, so two services that name the same slot and are given
   * nothing more specific share this one.
   */
  private ownSlots: SlotStore = createSlotStore();
  /**
   * Where this scope's slots actually come from, when they are not its own;
   * see `delegateSlots`.
   */
  private slotsFrom: (() => SlotStore | null) | null = null;

  /** Where who is signed in comes from, when this scope was not told itself;
   *  see `delegateIdentity`. */
  private identityFrom: (() => User | null) | null = null;

  /** The cells a service in this scope holds values in. */
  slots(): SlotStore {
    return this.slotsFrom?.() ?? this.ownSlots;
  }

  /**
   * Take slots from somewhere else rather than from this scope's own cells.
   *
   * A nested pipeline is a scope nobody provisions, so the service holding it
   * decides which cells it sees: its own, where it scopes them, and otherwise
   * the ones around it. Asked for on each lookup rather than copied, so that
   * changing what a scope keeps to itself takes effect without rebuilding, and
   * so that nesting composes outward one level at a time.
   */
  delegateSlots(source: () => SlotStore | null): void {
    this.slotsFrom = source;
  }

  /**
   * Take who is signed in from somewhere else rather than from this scope.
   *
   * A nested pipeline is a scope nobody provisions, so nobody tells it who is
   * signed in; the service holding it points it at the app around it. Asked
   * on each lookup, so that signing in or out is seen at any depth.
   */
  delegateIdentity(source: () => User | null): void {
    this.identityFrom = source;
  }

  /** Who is signed in to the app, as a service in this scope is to see it. */
  signedInUser(): User | null {
    return this.identityFrom ? this.identityFrom() : this.authenticatedUser;
  }

  registerLogTarget(target: (entry: LogEntry) => void): () => void {
    this.logTargets.add(target);
    return () => {
      this.logTargets.delete(target);
    };
  }

  setLogData(enabled: boolean) {
    this.logData = enabled;
  }

  emitLog(entry: LogEntry) {
    for (const target of this.logTargets) {
      target(entry);
    }
  }

  /** The run a service is being called in; see `AppImpl.currentContext`. */
  contextOf(svc: InstanceId): ProcessContext | undefined {
    const active = this.serviceContexts.get(svc.uuid) ?? [];
    if (active.length === 0) {
      return undefined;
    }
    const only = active[0];
    return active.every((run) => run === only) ? only : undefined;
  }

  private enterContext(svc: InstanceId, run: ProcessContext): void {
    const active = this.serviceContexts.get(svc.uuid) ?? [];
    active.push(run);
    this.serviceContexts.set(svc.uuid, active);
  }

  private leaveContext(svc: InstanceId, run: ProcessContext): void {
    const active = this.serviceContexts.get(svc.uuid);
    if (!active) {
      return;
    }
    const index = active.lastIndexOf(run);
    if (index !== -1) {
      active.splice(index, 1);
    }
    if (active.length === 0) {
      this.serviceContexts.delete(svc.uuid);
    }
  }

  /**
   * Calls arbitrary service-facing code inside a run without changing whether
   * that code is synchronous or asynchronous.
   *
   * Browser panels share a JavaScript process with their services, so they do
   * not naturally cross the authenticated REST/coordinator boundary. The UI
   * service handle uses this method to create the same boundary in-process.
   */
  callInContext<T>(svc: InstanceId, run: ProcessContext, call: () => T): T {
    this.enterContext(svc, run);
    try {
      const result = call();
      if (
        result !== null &&
        (typeof result === "object" || typeof result === "function") &&
        typeof (result as any).then === "function"
      ) {
        return Promise.resolve(result).finally(() => {
          this.leaveContext(svc, run);
        }) as T;
      }
      this.leaveContext(svc, run);
      return result;
    } catch (error) {
      this.leaveContext(svc, run);
      throw error;
    }
  }

  defer(run: ProcessContext): void {
    this.deferredRuns.set(run, (this.deferredRuns.get(run) ?? 0) + 1);
  }

  resume(run: ProcessContext): boolean {
    const pending = this.deferredRuns.get(run) ?? 0;
    if (pending <= 0) {
      return false;
    }
    if (pending === 1) {
      this.deferredRuns.delete(run);
    } else {
      this.deferredRuns.set(run, pending - 1);
    }
    return true;
  }

  log(svc: InstanceId, level: LogLevel, event: string, data?: unknown) {
    const context = this.contextOf(svc);
    // Nothing to attribute an entry to means nothing worth recording: an entry
    // that names no run cannot be found again.
    if (!context?.runId || this.logTargets.size === 0) {
      return;
    }

    const entry: LogEntry = {
      runId: context.runId,
      ts: new Date().toISOString(),
      runtimeId: this.descriptor.id,
      serviceUuid: svc.uuid,
      level,
      event,
    };
    if (context.parentRunId) {
      entry.parentRunId = context.parentRunId;
    }
    if (context.actor.kind === "person") {
      entry.caller = context.actor.sub;
    }
    if (this.logData && data !== undefined) {
      entry.data = data;
    }
    this.emitLog(entry);
  }

  constructor(runtime: RuntimeDescriptor, registry: BrowserRegistry) {
    this.descriptor = runtime;
    this.registry = registry;
    this.serviceInstances = [];
    this.subservices = {};
    this.app = createBrowserRuntimeApp(this);
  }

  getApi(): RuntimeApi {
    return api;
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    _instanceId: string | null,
    _result: any,
    _context?: ProcessContext | null,
  ): Promise<void> => {
    console.warn("BrowserRuntimeScope.onResult not set");
  };

  onAction = (_action: ServiceAction) => {
    console.warn("BrowserRuntimeScope.onAction not implemented");
    return false;
  };

  findServiceInstance = (uuid: string | null): InstanceIndexTuple => {
    if (uuid === null) {
      return [this.serviceInstances[0], 0];
    }

    const { parent } = this.subservices[uuid] || {};
    const searchUuid = parent ? parent.uuid : uuid;
    const idx = this.serviceInstances.findIndex((i) => i.uuid === searchUuid);
    return idx === -1 ? [null, -1] : [this.serviceInstances[idx], idx];
  };

  appendService = (svc: ServiceInstance) => {
    this.serviceInstances.push(svc);
  };

  removeService = async (
    service: ServiceInstance,
  ): Promise<Array<ServiceDescriptor>> => {
    const subserviceIds = Object.keys(this.subservices).filter((ssvcUuid) => {
      const ssvc = this.subservices[ssvcUuid];
      return !!ssvc && ssvc.parent === service;
    });

    const subservices = subserviceIds.reduce<ServiceInstance[]>(
      (all, ssvcUuid) => {
        const ssvc = this.subservices[ssvcUuid];
        return ssvc && ssvc.parent === service ? [...all, ssvc.service] : all;
      },
      [],
    );

    if (subservices.length > 0) {
      await Promise.all(
        subservices.map(async (ssvc) => ssvc.destroy && ssvc.destroy()),
      );
      for (const ssvcUuid of subserviceIds) {
        delete this.subservices[ssvcUuid];
      }
    }

    if (service.destroy) {
      await service.destroy();
    }

    this.serviceInstances = this.serviceInstances.filter(
      (svc) => svc.uuid !== service.uuid,
    );

    return this.serviceInstances.map(
      ({ uuid, serviceId = "", serviceName = "" }) => ({
        uuid,
        serviceId,
        serviceName,
      }),
    );
  };

  removeSubservices = async () => {
    for (const ssvcUuid of Object.keys(this.subservices)) {
      const ssvc = this.subservices[ssvcUuid];
      if (ssvc.service.destroy) {
        await ssvc.service.destroy();
      }
    }
    this.subservices = {};
  };

  getSubservice = (ssvcUuid: string): ServiceInstance | null => {
    const m = this.subservices[ssvcUuid];
    return m ? m.service : null;
  };

  // service parameter can be null, then starts with the first service.
  // reportResult: false when the caller consumes the returned result itself, so
  // the run does not also leave through onResult — which would hand the same
  // result onward a second time.
  next = async (
    service: InstanceId | null,
    params: any,
    context?: ProcessContext | null,
    advanceBeforeProcess: boolean = true,
    reportResult: boolean = true,
  ) => {
    if (this.isDisposing) {
      return null;
    }
    const generation = this.passGeneration;
    const deferredBefore = context
      ? (this.deferredRuns.get(context) ?? 0)
      : 0;

    const services = this.serviceInstances;
    const [svc_, position] = this.findServiceInstance(service?.uuid || null);
    if (position === -1) {
      if (!this.isDisposing) {
        return console.error(
          `Called next() in browser but could not find current service: ${service?.uuid} in scope:`,
          this,
        );
      }
      return null;
    }
    let svc = svc_;

    let result = params;
    for (
      let i = advanceBeforeProcess ? position + 1 : position;
      !!services[i] && result !== null;
      ++i
    ) {
      if (runExpired(context)) {
        return null;
      }
      if (this.isDisposing || generation !== this.passGeneration) {
        return null;
      }
      svc = services[i];
      if (svc && !svc.bypass) {
        try {
          onServiceProcess(this.app, svc, params);
          if (context) {
            this.enterContext(svc, context);
          }
          result = await svc.process(params);
          onServiceResult(this.app, svc, result);
          params = result;
        } catch (err: any) {
          console.warn(
            `Seriously: service ${
              svc.serviceName
            } caused error: ${JSON.stringify(err.message)}`,
          );
        } finally {
          if (context) {
            this.leaveContext(svc, context);
          }
        }
      }
    }

    if (generation !== this.passGeneration) {
      return null;
    }
    if (
      reportResult &&
      !this.isDisposing &&
      (!context ||
        (this.deferredRuns.get(context) ?? 0) <= deferredBefore)
    ) {
      this.onResult(svc ? svc.uuid : null, result, context);
    }
    return result;
  };

  /**
   * Ends every pass running in this scope, and in the scopes of the services
   * in it, at any depth.
   *
   * A pass ends at the service it is in: that one finishes — a waiting Timer
   * waits out its delay — and then nothing after it runs and nothing leaves.
   * Passes started afterwards are not affected. What stops a service emitting
   * of its own accord, such as a periodic Timer, is that service's to say.
   */
  cancelInFlight = () => {
    this.passGeneration += 1;
    for (const svc of this.serviceInstances) {
      (svc as { cancelInFlight?: () => void }).cancelInFlight?.();
    }
  };

  rearrangeServices = (rearranged: Array<ServiceDescriptor>) => {
    this.serviceInstances = rearranged.map(
      (svc) => this.findServiceInstance(svc.uuid)[0]!, // the instance must exist
    );
  };

  processRuntimeByName = async (
    _name: string,
    _params: any,
    _run?: ProcessContext | null,
  ): Promise<any> => {
    console.warn("processRuntimeByName not implemented");
  };

  configureServiceInRuntime = async (
    _runtimeId: string,
    _serviceUuid: string,
    _config: any,
    _run?: ProcessContext | null,
  ): Promise<void> => {
    console.warn("configureServiceInRuntime not implemented");
  };

  // Assigned by the host that has board context (see BrowserRuntime). Null when
  // this scope runs outside a board it can see: callers treat "no coordinator"
  // as a normal, retryable state rather than an error.
  coordinator: BoardCoordinator | null = null;

  /**
   * The board's asset descriptors, as the document that contributed this
   * runtime declares them: for a browser runtime its asset store *is* the
   * board's `assets`, read as they are now. Assigned by whoever restores the
   * runtime, or by the service hosting a nested pipeline.
   */
  assets?: AssetsSource;

  serializeState = () => {
    return this.state;
  };

  setState = (partialUpdate: { [key: string]: any }) => {
    this.state = { ...this.state, ...partialUpdate };
  };
}
