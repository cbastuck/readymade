/**
 * Service Documentation
 * Service ID: hookup.to/service/process-router
 * Service Name: Process Router
 *
 * Routes incoming data to another service's process() input, enabling feedback
 * loops and state-machine patterns within a single runtime.
 *
 * Unlike Configurator (which calls configure()), Process Router calls process()
 * on the target — so the target handles the routed data as pipeline input.
 *
 * An optional inner pipeline transforms params before routing. The pipeline
 * receives params merged with `context` (extra data stored in this service's
 * state), making credentials or other config available to inner Map expressions
 * as `params.myKey` without mixing them into the outer pipeline's params.
 *
 * State shape:
 *   {
 *     targetServiceUuid: string,        // uuid of the service to route to
 *     condition?:        string,        // expression; skip routing when falsy
 *     passThrough:       boolean,       // true → also continue chain; false → stop (default)
 *     context?:          Record<string,any>, // merged into params before pipeline
 *     pipeline:          PipelineEntry[],    // transform pipeline before routing
 *   }
 */

import { AppImpl, ServiceClass, ServiceInstance } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import {
  evalExpression,
  parseExpression,
  Expression,
  SyntaxError,
} from "./base/eval";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";

const serviceId = "hookup.to/service/process-router";
const serviceName = "Process Router";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  targetServiceUuid: string;
  condition?: string;
  passThrough: boolean;
  context?: Record<string, any>;
  pipeline: PipelineEntry[];
};

export class ProcessRouter extends ServiceBase<State> {
  _parsedCondition: Expression | SyntaxError | null = null;
  _scope: BrowserRuntimeScope | null = null;
  private _scopeGeneration = 0;
  private _scopeBuilding: Promise<void> | null = null;

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      targetServiceUuid: "",
      condition: undefined,
      passThrough: false,
      context: undefined,
      pipeline: [],
    });
  }

  configure(config: any): void {
    if (config.targetServiceUuid !== undefined) {
      this.state.targetServiceUuid = config.targetServiceUuid;
    }
    if (config.condition !== undefined) {
      this.state.condition = config.condition;
      this._parsedCondition = config.condition
        ? parseExpression(config.condition)
        : null;
    }
    if (config.passThrough !== undefined) {
      this.state.passThrough = config.passThrough;
    }
    if (config.context !== undefined) {
      this.state.context = { ...this.state.context, ...config.context };
    }
    if (Array.isArray(config.pipeline)) {
      this.state.pipeline = config.pipeline.map((entry: any) => ({
        serviceId: entry.serviceId,
        instanceId: entry.instanceId || entry.uuid || crypto.randomUUID(),
        ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
        ...(entry.state ? { state: entry.state } : {}),
      }));
      this._rebuildScope();
    }
  }

  async process(params: any): Promise<any> {
    const { targetServiceUuid, passThrough } = this.state;

    if (this._parsedCondition) {
      const shouldRoute = await evalExpression(
        this._parsedCondition,
        { params },
        this.app,
      );
      if (!shouldRoute) {
        return params;
      }
    }

    const enriched = this.state.context
      ? { ...this.state.context, ...params }
      : params;

    const transformed = await this._transform(enriched);

    if (targetServiceUuid && transformed !== null) {
      const target = this.app.getServiceById(targetServiceUuid);
      if (target?.process) {
        await target.process(transformed);
      }
    }

    return passThrough ? params : null;
  }

  getInnerInstance(instanceId: string): ServiceInstance | null {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
  }

  destroy(): void {
    this._teardownScope();
  }

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
    })();
  }

  private async _buildScope(): Promise<BrowserRuntimeScope> {
    const registry = new BrowserRegistry();
    const scope = new BrowserRuntimeScope(
      {
        id: `process-router-${this.uuid}`,
        name: "Process Router Pipeline",
        type: "browser",
      },
      registry,
    );

    for (const entry of this.state.pipeline) {
      const descriptor = await addService(
        scope,
        {
          serviceId: entry.serviceId,
          serviceName: entry.serviceName ?? entry.serviceId,
        },
        entry.instanceId,
      );
      if (descriptor && entry.state) {
        await configureService(scope, descriptor, entry.state);
      }
    }

    return scope;
  }
}

import ProcessRouterUI from "./ProcessRouterUI";

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new ProcessRouter(app, board, descriptor, id),
  createUI: ProcessRouterUI,
};

export default descriptor;
