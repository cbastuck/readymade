import {
  AppImpl,
  RuntimeClassType,
  ServiceClass,
  ServiceInstance,
} from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import FeedbackServiceUI from "./FeedbackServiceUI";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";

const serviceId = "hookup.to/service/feedback";
const serviceName = "Feedback";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  // Runtime variable name: when the variable is truthy, forward inner output
  // downstream; while falsy, suppress (inner pipeline routes internally).
  skipFeedbackWhen: string;
  pipeline: PipelineEntry[];
};

export class FeedbackService extends ServiceBase<State> {
  _scope: BrowserRuntimeScope | null = null;
  private _scopeGeneration = 0;
  _scopeBuilding: Promise<void> | null = null;

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      skipFeedbackWhen: "",
      pipeline: [],
    });
  }

  configure(config: any): void {
    let changed = false;

    if (config.skipFeedbackWhen !== undefined) {
      this.state.skipFeedbackWhen = config.skipFeedbackWhen;
      this.app.notify(this, { skipFeedbackWhen: config.skipFeedbackWhen });
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
    }

    // Proxy a configure command into a named inner service.
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
            this.app.notify(this as any, { __innerScopeReady: true });
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

    // Reset a named runtime variable (e.g. on disconnect to restart handshake).
    if (config.resetVariable) {
      this.app.setRuntimeVariable(config.resetVariable, false);
    }

    if (changed) {
      this._rebuildScope();
    }
  }

  // FeedbackService is a self-driving source; synchronous process() is unused.
  process(_params: any): any {
    return null;
  }

  getInnerInstance(instanceId: string): ServiceInstance | null {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
  }

  destroy(): void {
    this._teardownScope();
  }

  private _handleResult(result: any): void {
    if (result === null || result === undefined || this.bypass) {
      return;
    }

    const variables = this.app.getRuntimeVariable();
    const shouldForward = this.state.skipFeedbackWhen
      ? !!variables[this.state.skipFeedbackWhen]
      : false;

    if (shouldForward) {
      this.app.next(this, result);
    } else {
      this._scope?.next(null, result, null, false);
    }
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
      {
        id: `feedback-inner-${this.uuid}`,
        name: "Feedback Inner",
        type: "browser" as RuntimeClassType,
      },
      registry,
    );

    scope.onResult = async (_instanceId: string | null, result: any) => {
      this._handleResult(result);
    };

    // Propagate runtime variables up through the scope hierarchy so that
    // nested SetRuntimeVariable services write to the outer runtime's store.
    scope.app.getRuntimeVariable = () => this.app.getRuntimeVariable();
    scope.app.setRuntimeVariable = (key: string, value: any) =>
      this.app.setRuntimeVariable(key, value);

    // Forward inner notifications to the outer app so service UIs update.
    const outerNotify = this.app.notify.bind(this.app);
    const innerNotify = scope.app.notify.bind(scope.app);
    scope.app.notify = (svc: any, notification: any) => {
      innerNotify(svc, notification);
      outerNotify(svc, notification);
    };

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
    new FeedbackService(app, board, descriptor, id),
  createUI: FeedbackServiceUI,
};

export default descriptor;
