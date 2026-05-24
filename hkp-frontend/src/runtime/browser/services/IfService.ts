import { AppImpl, RuntimeClassType, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import IfServiceUI from "./IfServiceUI";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";
import {
  parseExpression,
  evalExpression,
  Expression,
  SyntaxError,
} from "./base/eval";

const serviceId = "hookup.to/service/if";
const serviceName = "If";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  condition: string;
  pipeline: PipelineEntry[];
  ignoreInnerResult?: boolean;
};

class IfService extends ServiceBase<State> {
  private _parsedCondition: Expression | SyntaxError | null = null;
  private _scope: BrowserRuntimeScope | null = null;
  private _scopeGeneration = 0;
  private _scopeBuilding: Promise<void> | null = null;

  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      condition: "",
      pipeline: [],
    });
  }

  configure(config: any): void {
    let rebuildNeeded = false;

    if (config.condition !== undefined) {
      this.state.condition = config.condition;
      this._parsedCondition = config.condition
        ? parseExpression(config.condition)
        : null;
      this.app.notify(this, { condition: config.condition });
    }

    if (config.ignoreInnerResult !== undefined) {
      this.state.ignoreInnerResult = config.ignoreInnerResult;
    }

    if (Array.isArray(config.pipeline)) {
      this.state.pipeline = config.pipeline.map((entry: any) => ({
        serviceId: entry.serviceId,
        instanceId: entry.instanceId || crypto.randomUUID(),
        ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
        ...(entry.state ? { state: entry.state } : {}),
      }));
      rebuildNeeded = true;
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
      rebuildNeeded = true;
    } else if (typeof config.removeService === "string") {
      this.state.pipeline = this.state.pipeline.filter(
        (e) => e.instanceId !== config.removeService,
      );
      rebuildNeeded = true;
    }

    if (config.configureService) {
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
          });
        }
      } else {
        this.state.pipeline = this.state.pipeline.map((e) =>
          e.instanceId === instanceId
            ? { ...e, state: { ...e.state, ...state } }
            : e,
        );
      }
    }

    if (rebuildNeeded) {
      this._rebuildScope();
    }
  }

  async process(params: any): Promise<any> {
    if (this._parsedCondition !== null) {
      const conditionMet = await evalExpression(
        this._parsedCondition,
        { params },
        this.app,
      );
      if (conditionMet && this.state.pipeline.length > 0) {
        if (!this._scope) {
          await this._scopeBuilding;
        }
        if (this._scope) {
          const result = await this._scope.next(null, params, null, false);
          if (!this.state.ignoreInnerResult) {
            return result;
          }
        }
      }
    }
    return params;
  }

  destroy(): void {
    this._teardownScope();
  }

  private _teardownScope(): void {
    this._scope = null;
    this._scopeBuilding = null;
    this._scopeGeneration++;
  }

  getInnerInstance(instanceId: string): any {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
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
      this.app.notify(this, { __innerScopeReady: true });
    })();
  }

  private async _buildScope(): Promise<BrowserRuntimeScope> {
    const registry = new BrowserRegistry();
    const scope = new BrowserRuntimeScope(
      {
        id: `if-inner-${this.uuid}`,
        name: "If Pipeline",
        type: "browser" as RuntimeClassType,
      },
      registry,
    );

    // Propagate runtime variables up through the scope hierarchy
    scope.app.getRuntimeVariable = () => this.app.getRuntimeVariable();
    scope.app.setRuntimeVariable = (key: string, value: any) =>
      this.app.setRuntimeVariable(key, value);

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

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new IfService(app, board, descriptor, id),
  createUI: IfServiceUI,
};

export default descriptor;
