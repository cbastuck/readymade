/**
 * Service Documentation
 * Service ID: sub-service
 * Service Name: Browser Sub-Service
 * Modes: pipeline (default) | source
 *
 * pipeline mode: instantiates the nested pipeline as a live BrowserRuntimeScope
 *   and passes incoming data through it, emitting the final result downstream.
 *   Asynchronous emissions from nested services (e.g. a Timer) are forwarded to
 *   the outer pipeline via scope.onResult.
 *   Matches the behaviour of sub_service in hkp-rt, hkp-node, hkp-python.
 *
 * source mode: on configure() and process(), emits the full board descriptor JSON
 *   (runtimes + services) so downstream services can compress and embed it in a
 *   QR code URL.  Use this when the sub-service wraps a remote/phone runtime
 *   rather than running locally.
 *
 * State shape:
 *   {
 *     mode:        "pipeline" | "source",
 *     boardName:   string,
 *     runtimeId:   string,
 *     runtimeName: string,
 *     runtimeType: string,
 *     pipeline: [
 *       { serviceId, instanceId, serviceName?, state? },
 *       ...
 *     ]
 *   }
 */

import { AppImpl, RuntimeClassType, ServiceClass, ServiceInstance } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import BrowserSubServiceUI from "./BrowserSubServiceUI";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { renameLiveServices, renamedEntries } from "../pipelineNames";
import { addService, configureService } from "../BrowserRuntimeApi";
import { createSlotStore, SlotStore } from "../../slots";
import { joinAddress, splitAddress } from "../../board/address";

const serviceId = "sub-service";
const serviceName = "Browser Sub-Service";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  mode: "pipeline" | "source";
  /**
   * Whether what this pipeline produced leaves this service.
   *
   * A scope that ends here rather than feeding the services after it: the two
   * flows on one runtime that a Stopper between them used to mark by
   * convention. False — and absent — is the pipeline a board already has, so
   * every board that says nothing about it goes on passing its result along.
   *
   * It closes **both** routes out: `process` answers null, and the inner
   * scope's `onResult` — a Timer tick, a service that answered late — stops
   * being handed onward.
   */
  stopPropagation: boolean;
  /**
   * What this scope keeps to itself. One block rather than a flat key because
   * a scope has more than one thing to say about what its children can see.
   */
  scope: { slots: "own" | "inherit" };
  boardName: string;
  runtimeId: string;
  runtimeName: string;
  runtimeType: string;
  pipeline: PipelineEntry[];
  facade?: any;
};

export class BrowserSubService extends ServiceBase<State> {
  // The resolved inner scope (null while building or in source mode).
  _scope: BrowserRuntimeScope | null = null;
  // Tracks the current build so stale async completions are ignored.
  private _scopeGeneration = 0;
  // Resolves when the current scope build is finished.
  _scopeBuilding: Promise<void> | null = null;
  /**
   * The cells a scope of its own holds values in.
   *
   * Owned here rather than left to the inner scope so that rebuilding the
   * pipeline — which a board does on every edit to it — does not drop what was
   * being held across it.
   */
  private _slots: SlotStore = createSlotStore();

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      mode: "pipeline",
      boardName: "",
      runtimeId: "browser-runtime",
      runtimeName: "Browser Runtime",
      runtimeType: "browser",
      stopPropagation: false,
      scope: { slots: "own" },
      pipeline: [],
    });
  }

  configure(config: Partial<State> & {
    scope?: { slots?: string };
    pipeline?: any[];
    appendService?: { serviceId: string; instanceId?: string; serviceName?: string; state?: Record<string, any> };
    removeService?: string;
    configureService?: { instanceId: string; state: Record<string, any> };
    cancel?: boolean;
  }): void {
    let changed = false;

    // A command, not state: ends what is running inside, keeps what is built.
    if (config.cancel === true) {
      this.cancelInFlight();
    }

    if (config.mode !== undefined) {
      this.state.mode = config.mode;
      changed = true;
    }
    if (config.boardName !== undefined) {
      this.state.boardName = config.boardName;
      changed = true;
    }
    if (config.runtimeId !== undefined) {
      this.state.runtimeId = config.runtimeId;
      changed = true;
    }
    if (config.runtimeName !== undefined) {
      this.state.runtimeName = config.runtimeName;
      changed = true;
    }
    if (config.runtimeType !== undefined) {
      this.state.runtimeType = config.runtimeType;
      changed = true;
    }

    // Read only when it is a boolean, so a board that never mentions it keeps
    // the default rather than having one written over it by silence.
    if (typeof config.stopPropagation === "boolean") {
      this.state.stopPropagation = config.stopPropagation;
      // Read on the way out of every call and every push, so saying it is all
      // it takes — and rebuilding the pipeline to change where its answer goes
      // would restart whatever it is running. Reported instead, for the panel
      // that offers the choice.
      this.app.notify(this as any, {
        stopPropagation: this.state.stopPropagation,
      });
    }
    if (
      config.scope &&
      (config.scope.slots === "own" || config.scope.slots === "inherit")
    ) {
      this.state.scope = { slots: config.scope.slots };
      // Re-points the cells the inner scope reaches, and nothing else: the
      // delegate is read on every lookup, so no service has to be recreated
      // for this — and recreating them would restart whatever the scope is
      // running, which is a heavy answer to a question about where a value is
      // kept. Reported rather than marked `changed` for the same reason: a
      // panel showing these cells has to know, a rebuild is not what it needs.
      this._applySlots();
      this.app.notify(this as any, { scope: this.state.scope });
    }

    if (config.facade !== undefined) {
      this.state.facade = config.facade;
      changed = true;
    }

    // A rename arrives as the whole pipeline with one name changed; applied
    // in place, since rebuilding would restart what the pipeline runs.
    const renamed = renamedEntries(this.state.pipeline, config.pipeline);
    if (renamed) {
      this.state.pipeline = renamed;
      renameLiveServices(this._scope, renamed);
      this.app.notify(this as any, { __innerScopeReady: true });
    } else if (Array.isArray(config.pipeline)) {
      this.state.pipeline = config.pipeline.map((entry: any) => ({
        serviceId: entry.serviceId,
        instanceId: entry.instanceId || entry.uuid || crypto.randomUUID(),
        ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
        ...(entry.state ? { state: entry.state } : {}),
      }));
      changed = true;
    } else if (config.appendService) {
      const entry = config.appendService;
      this.state.pipeline = [
        ...this.state.pipeline,
        {
          serviceId: entry.serviceId,
          instanceId: entry.instanceId || crypto.randomUUID(),
          ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
          ...(entry.state ? { state: entry.state } : {}),
        },
      ];
      changed = true;
    } else if (typeof config.removeService === "string") {
      this.state.pipeline = this.state.pipeline.filter(
        (e) => e.instanceId !== config.removeService,
      );
      changed = true;
    } else if (config.configureService) {
      const { instanceId, state } = config.configureService;
      if (this._scope) {
        // Scope is live — forward the raw config directly to the real instance.
        // This preserves command semantics: appendService, removeService, etc.
        // are handled by the instance's own configure() instead of being merged
        // into the stored state as inert properties.
        const [svc] = this._scope.findServiceInstance(instanceId);
        if (svc?.configure) {
          svc.configure(state);
          // Read back the updated state so persistence is correct.
          Promise.resolve(
            svc.getConfiguration ? svc.getConfiguration() : (svc as any).state,
          ).then((updatedState) => {
            this.state.pipeline = this.state.pipeline.map((e) =>
              e.instanceId === instanceId ? { ...e, state: updatedState } : e,
            );
            // Re-render our own UI so the updated inner pipeline is visible.
            this.app.notify(this as any, { __innerScopeReady: true });
          });
        }
      } else {
        // Scope not built yet — naive merge (works for simple flat state).
        this.state.pipeline = this.state.pipeline.map((e) =>
          e.instanceId === instanceId ? { ...e, state: { ...e.state, ...state } } : e,
        );
        changed = true;
      }
      return;
    }

    if (changed) {
      if (this.state.mode === "source") {
        // Tear down any live scope — source mode doesn't need it.
        this._teardownScope();
        this.app.next(this, this.buildBoardDescriptor());
      } else {
        // Eagerly rebuild the inner scope so nested services (e.g. Timer) start
        // immediately without waiting for an explicit process() call.
        this._rebuildScope();
      }
    }
  }

  async process(input: any): Promise<any> {
    if (this.state.mode === "source") {
      return this.buildBoardDescriptor();
    }

    // Ensure scope is built before processing.
    if (!this._scope) {
      await this._scopeBuilding;
    }
    if (!this._scope) {
      // A scope that passes nothing on passes nothing on when there is nothing
      // to run either: what leaves this service is the board author's to say,
      // and it does not become the input again because the pipeline was empty.
      return this.state.stopPropagation ? null : input;
    }
    // Answered by returning, so not reported through onResult as well.
    const result = await this._scope.next(null, input, null, false, false);
    return this.state.stopPropagation ? null : result;
  }

  /**
   * Points the inner scope at the cells its values are held in.
   *
   * Read on each lookup rather than copied, so that changing what a scope keeps
   * to itself takes effect without rebuilding the pipeline, and so that a scope
   * inside a scope reaches outward the same way one level at a time.
   */
  private _applySlots(scope: BrowserRuntimeScope | null = this._scope): void {
    scope?.delegateSlots(() =>
      this.state.scope.slots === "inherit"
        ? (this.app.slots?.() ?? null)
        : this._slots,
    );
  }

  /**
   * The cells the services inside this scope hold values in, and whether the
   * scope reached out of itself for them.
   *
   * Asked of the built scope rather than of `state.scope.slots`, because the
   * two can differ: a scope that says `inherit` where nothing around it
   * provides cells still holds, in cells of its own. What makes them inherited
   * is that they are the same store the surrounding scope hands out — which is
   * also what a reader wants to know, since those cells are shared with
   * whatever else is out there naming the same slot.
   */
  slotsInUse(): { store: SlotStore | null; inherited: boolean } {
    const store = this._scope?.slots() ?? null;
    return {
      store,
      inherited: store !== null && store === this.app.slots?.(),
    };
  }

  /**
   * What a board keeps of this scope: the pipeline as its services are now.
   *
   * A service inside can be configured without going through this one — a
   * facade control addressing it by its scoped address reaches the live
   * instance directly — so the stored pipeline alone would save what the
   * services were built with, not what they were changed to since.
   */
  getConfiguration = async (): Promise<Partial<State> & { bypass: boolean }> => {
    const pipeline = await Promise.all(
      this.state.pipeline.map(async (entry) => {
        const live = this.getInnerInstance(entry.instanceId) as any;
        if (!live?.getConfiguration) {
          return entry;
        }
        return { ...entry, state: await live.getConfiguration() };
      }),
    );
    return { ...this.state, pipeline, bypass: this.bypass };
  };

  /**
   * Ends every pass running inside this scope, at any depth; see
   * BrowserRuntimeScope.cancelInFlight. Also what a scope around this one
   * calls when it is cancelled.
   */
  cancelInFlight(): void {
    this._scope?.cancelInFlight();
  }

  /** Returns the real inner ServiceInstance for a given instanceId, once built. */
  getInnerInstance(instanceId: string): ServiceInstance | null {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
  }

  /**
   * The service a scoped address names inside this one, however deep.
   *
   * What makes a sub-pipeline addressable from outside: without it a board can
   * reach this service but nothing it contains, so a facade could drive a
   * scope but not read what the scope is doing.
   */
  findNested(address: string): ServiceInstance | null {
    const segments = splitAddress(address);
    if (segments.length === 0) {
      return null;
    }
    const here = this.getInnerInstance(segments[0]);
    if (!here || segments.length === 1) {
      return segments.length === 1 ? here : null;
    }
    const deeper = here as unknown as BrowserSubService;
    return typeof deeper.findNested === "function"
      ? deeper.findNested(segments.slice(1).join("."))
      : null;
  }

  /**
   * Enters this service's pipeline at one of its services.
   *
   * The inner scope is a chain like any other, so this is the board's own
   * "process at" one level down: what follows the named service inside this
   * scope runs, and what precedes it does not.
   */
  async processNested(address: string, payload: unknown): Promise<unknown> {
    if (!this._scope) {
      await this._scopeBuilding;
    }
    const segments = splitAddress(address);
    if (!this._scope || segments.length === 0) {
      return null;
    }
    const here = this.getInnerInstance(segments[0]);
    if (!here) {
      return null;
    }
    if (segments.length > 1) {
      const deeper = here as unknown as BrowserSubService;
      return typeof deeper.processNested === "function"
        ? deeper.processNested(segments.slice(1).join("."), payload)
        : null;
    }
    // false: begin *at* this service; the default advances past it.
    return this._scope.next(here, payload, null, false);
  }

  destroy(): void {
    this._teardownScope();
  }

  // -------------------------------------------------------------------------

  private _teardownScope(): void {
    this._scope = null;
    this._scopeBuilding = null;
    this._scopeGeneration++;
  }

  private _rebuildScope(): void {
    const generation = ++this._scopeGeneration;
    this._scope = null;

    this._scopeBuilding = (async () => {
      const scope = await this._buildScope();
      if (generation !== this._scopeGeneration) {
        return; // superseded by a newer configure() call
      }
      this._scope = scope;
      // Let the UI know inner instances are now available for wiring.
      this.app.notify(this as any, { __innerScopeReady: true });
    })();
  }

  private async _buildScope(): Promise<BrowserRuntimeScope> {
    const registry = new BrowserRegistry();
    const scope = new BrowserRuntimeScope(
      {
        id: this.state.runtimeId,
        name: this.state.runtimeName,
        type: this.state.runtimeType as RuntimeClassType,
      },
      registry,
    );
    // Before any service is added: a service may hold a value while it is
    // being configured (a Hold given a value to write), and it has to land in
    // the cells the scope will go on using, not in ones replaced after.
    this._applySlots(scope);

    // Forward async results from the inner pipeline (e.g. Timer ticks) to the
    // outer pipeline so downstream services see the output.
    scope.onResult = async (_instanceId, result) => {
      // The second route out, and the one a scope would otherwise leak
      // through. What arrives here was not produced by a call this service is
      // answering, so nothing has already been stopped on its behalf: a Timer
      // inside a scope would go on driving the board after the scope's own
      // answers had stopped. `process` answering null does not cover this,
      // which is why stopping propagation has to be said in both places.
      if (this.state.stopPropagation) {
        return;
      }
      if (result !== null && result !== undefined) {
        this.app.next(this, result);
      }
    };

    // Forward inner-scope notifications to the outer app so that service UIs —
    // which register their notification targets on the outer app via the proxy
    // instance — receive updates (e.g. Monitor.process calls this.app.notify).
    // Because this.app for a nested BrowserSubService is itself already the
    // wrapped notify of its parent, the chain propagates to any nesting depth.
    const outerNotify = this.app.notify.bind(this.app);
    const innerNotify = scope.app.notify.bind(scope.app);
    scope.app.notify = (svc: any, notification: any) => {
      innerNotify(svc, notification);
      // Outward under a scoped address rather than the bare instanceId: an
      // instanceId is unique only inside its own pipeline, so on its own it is
      // a name, not an address. `address` rather than `uuid` because the
      // service is still called what it is called in here — one job each, the
      // same split a mount makes. An inner scope has already prefixed its own,
      // so this composes to any depth.
      outerNotify(
        { ...svc, address: joinAddress(this.uuid, svc.address ?? svc.uuid) },
        notification,
      );
    };

    for (const entry of this.state.pipeline) {
      const descriptor = await addService(
        scope,
        { serviceId: entry.serviceId, serviceName: entry.serviceName ?? entry.serviceId },
        entry.instanceId,
      );
      if (descriptor && entry.state) {
        await configureService(scope, descriptor, entry.state);
      }
    }

    return scope;
  }

  buildBoardDescriptor() {
    const { boardName, runtimeId, runtimeName, runtimeType, pipeline, facade } =
      this.state;
    return {
      ...(boardName ? { boardName } : {}),
      ...(facade ? { facade } : {}),
      runtimes: [{ id: runtimeId, name: runtimeName, type: runtimeType }],
      services: {
        [runtimeId]: pipeline.map((entry) => ({
          uuid: entry.instanceId,
          serviceId: entry.serviceId,
          ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
          ...(entry.state ? { state: entry.state } : {}),
        })),
      },
    };
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new BrowserSubService(app, board, descriptor, id),
  createUI: BrowserSubServiceUI,
};

export default descriptor;
