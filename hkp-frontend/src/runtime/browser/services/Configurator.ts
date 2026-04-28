/**
 * Service Documentation
 * Service ID: hookup.to/service/configurator
 * Service Name: Configurator
 *
 * Calls configure() on a target service with the incoming params, then either
 * stops the chain (passThrough: false, default) or passes params downstream
 * (passThrough: true).
 *
 * This is the dedicated routing primitive that replaces the configureServiceUuid
 * feature in the Map service. Map transforms, Configurator routes.
 *
 * Same-runtime:  set targetServiceUuid → resolved via app.getServiceById()
 * Cross-runtime: also set targetRuntime  → resolved via app.configureServiceInRuntime()
 *
 * Optional pipeline: a list of services run in sequence before configure() is
 * called. Use this to transform the incoming params into whatever shape the
 * target service's configure() protocol expects — without changing either the
 * upstream producer or the downstream target.
 *
 * State shape:
 *   {
 *     targetServiceUuid: string,   // uuid of the service to configure
 *     targetRuntime?:    string,   // runtime id; omit for same-runtime
 *     passThrough:       boolean,  // true → continue chain; false → stop (default)
 *     pipeline: [                  // optional transform pipeline
 *       { serviceId, instanceId, serviceName?, state? },
 *       ...
 *     ]
 *   }
 */

import { AppImpl, ServiceClass, ServiceInstance } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";

const serviceId = "hookup.to/service/configurator";
const serviceName = "Configurator";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  targetServiceUuid: string;
  targetRuntime?: string;
  passThrough: boolean;
  pipeline: PipelineEntry[];
};

export class Configurator extends ServiceBase<State> {
  _scope: BrowserRuntimeScope | null = null;
  private _scopeGeneration = 0;
  private _scopeBuilding: Promise<void> | null = null;

  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      targetServiceUuid: "",
      targetRuntime: undefined,
      passThrough: false,
      pipeline: [],
    });
  }

  configure(config: any): void {
    if (config.targetServiceUuid !== undefined) {
      this.state.targetServiceUuid = config.targetServiceUuid;
    }
    if (config.targetRuntime !== undefined) {
      this.state.targetRuntime = config.targetRuntime;
    }
    if (config.passThrough !== undefined) {
      this.state.passThrough = config.passThrough;
    }

    if (Array.isArray(config.pipeline)) {
      this.state.pipeline = config.pipeline.map((entry: any) => ({
        serviceId: entry.serviceId,
        instanceId: entry.instanceId || entry.uuid || crypto.randomUUID(),
        ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
        ...(entry.state ? { state: entry.state } : {}),
      }));
      this._rebuildScope();
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
      this._rebuildScope();
    } else if (typeof config.removeService === "string") {
      this.state.pipeline = this.state.pipeline.filter(
        (e) => e.instanceId !== config.removeService,
      );
      this._rebuildScope();
    } else if (config.configureService) {
      const { instanceId, state } = config.configureService;
      if (this._scope) {
        const [svc] = this._scope.findServiceInstance(instanceId);
        if (svc?.configure) {
          svc.configure(state);
          Promise.resolve(
            svc.getConfiguration ? svc.getConfiguration() : (svc as any).state,
          ).then((updatedState) => {
            this.state.pipeline = this.state.pipeline.map((e) =>
              e.instanceId === instanceId ? { ...e, state: updatedState } : e,
            );
            this.app.notify(this as any, { __innerScopeReady: true });
          });
        }
      } else {
        this.state.pipeline = this.state.pipeline.map((e) =>
          e.instanceId === instanceId ? { ...e, state: { ...e.state, ...state } } : e,
        );
      }
    }
  }

  getInnerInstance(instanceId: string): ServiceInstance | null {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
  }

  async process(params: any): Promise<any> {
    const { targetServiceUuid, targetRuntime, passThrough } = this.state;

    const configured = await this._transform(params);

    if (targetServiceUuid && configured !== null) {
      if (targetRuntime && this.app.configureServiceInRuntime) {
        await this.app.configureServiceInRuntime(targetRuntime, targetServiceUuid, configured);
      } else {
        const target = this.app.getServiceById(targetServiceUuid);
        if (target) {
          await target.configure(configured);
        }
      }
    }

    return passThrough ? params : null;
  }

  destroy(): void {
    this._teardownScope();
  }

  // -------------------------------------------------------------------------

  /** Run params through the inner pipeline if one is configured. */
  private async _transform(params: any): Promise<any> {
    if (this.state.pipeline.length === 0) {
      return params;
    }
    if (!this._scope) {
      await this._scopeBuilding;
    }
    if (!this._scope) {
      return params;
    }
    return this._scope.next(null, params, null, false);
  }

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
        return;
      }
      this._scope = scope;
      this.app.notify(this as any, { __innerScopeReady: true });
    })();
  }

  private async _buildScope(): Promise<BrowserRuntimeScope> {
    const registry = new BrowserRegistry();
    const scope = new BrowserRuntimeScope(
      { id: `configurator-${this.uuid}`, name: "Configurator Pipeline", type: "browser" },
      registry,
    );

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
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new Configurator(app, board, descriptor, id),
};

export default descriptor;
