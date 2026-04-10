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
import { addService, configureService } from "../BrowserRuntimeApi";

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
  boardName: string;
  runtimeId: string;
  runtimeName: string;
  runtimeType: string;
  pipeline: PipelineEntry[];
};

export class BrowserSubService extends ServiceBase<State> {
  // The resolved inner scope (null while building or in source mode).
  _scope: BrowserRuntimeScope | null = null;
  // Tracks the current build so stale async completions are ignored.
  private _scopeGeneration = 0;
  // Resolves when the current scope build is finished.
  _scopeBuilding: Promise<void> | null = null;

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
      pipeline: [],
    });
  }

  configure(config: Partial<State> & {
    pipeline?: any[];
    appendService?: { serviceId: string; instanceId?: string; serviceName?: string; state?: Record<string, any> };
    removeService?: string;
    configureService?: { instanceId: string; state: Record<string, any> };
  }): void {
    let changed = false;

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

    if (Array.isArray(config.pipeline)) {
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
      return input;
    }
    return this._scope.next(null, input, null, false);
  }

  /** Returns the real inner ServiceInstance for a given instanceId, once built. */
  getInnerInstance(instanceId: string): ServiceInstance | null {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
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

    // Forward async results from the inner pipeline (e.g. Timer ticks) to the
    // outer pipeline so downstream services see the output.
    scope.onResult = async (_instanceId, result) => {
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
      outerNotify(svc, notification);
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
    const { boardName, runtimeId, runtimeName, runtimeType, pipeline } =
      this.state;
    return {
      ...(boardName ? { boardName } : {}),
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
