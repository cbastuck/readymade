import { AppImpl, RuntimeClassType, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SwitchUI from "./SwitchUI";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";
import {
  parseExpression,
  evalExpression,
  Expression,
  SyntaxError,
} from "./base/eval";

/**
 * Service Documentation
 * Service ID: hookup.to/service/switch
 * Service Name: Switch
 * Modes: case routing
 * Key Config: cases ([{ when: <expression on params>, pipeline: [services] }]),
 *             default (pipeline run when no case matches),
 *             ignoreInnerResult
 * Input: any
 * Output: the matched case's pipeline result; pass-through when no case
 *         matches and no default pipeline is configured
 * Arrays: routed as a whole (predicates see the full array as params)
 * Binary: routed untouched
 * MixedData: not native in browser runtime
 *
 * The structured if/else of the browser runtime: the first case whose `when`
 * expression is truthy routes the input through its sub-pipeline. Conditions
 * are jsep expressions over { params } — e.g. "params.next",
 * "params.kind == 'audio'". An empty matched pipeline passes the input
 * through unchanged.
 */

const serviceId = "hookup.to/service/switch";
const serviceName = "Switch";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type SwitchCase = {
  when: string;
  pipeline: PipelineEntry[];
};

type State = {
  cases: SwitchCase[];
  default: PipelineEntry[];
  ignoreInnerResult?: boolean;
};

function normalizePipeline(pipeline: any): PipelineEntry[] {
  if (!Array.isArray(pipeline)) {
    return [];
  }
  return pipeline.map((entry: any) => ({
    serviceId: entry.serviceId,
    instanceId: entry.instanceId || crypto.randomUUID(),
    ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
    ...(entry.state ? { state: entry.state } : {}),
  }));
}

class Switch extends ServiceBase<State> {
  private _parsedConditions: Array<Expression | SyntaxError | null> = [];
  // One scope per case, plus the default pipeline's scope at the last index.
  private _scopes: Array<BrowserRuntimeScope | null> = [];
  private _scopesBuilding: Promise<void> | null = null;
  private _scopeGeneration = 0;

  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, {
      cases: [],
      default: [],
    });
  }

  configure(config: any): void {
    // Branch-scoped ops (from SubServicePipelineUI inside SwitchUI):
    // { branch: <case index> | "default", appendService | removeService |
    //   pipeline | configureService | when }
    if (config.branch !== undefined) {
      this._configureBranch(config);
      return;
    }

    let rebuildNeeded = false;

    if (Array.isArray(config.cases)) {
      this.state.cases = config.cases.map((c: any) => ({
        when: typeof c.when === "string" ? c.when : "",
        pipeline: normalizePipeline(c.pipeline),
      }));
      this._parsedConditions = this.state.cases.map((c) =>
        c.when ? parseExpression(c.when) : null,
      );
      this.app.notify(this, { cases: this.state.cases });
      rebuildNeeded = true;
    }

    if (Array.isArray(config.default)) {
      this.state.default = normalizePipeline(config.default);
      this.app.notify(this, { default: this.state.default });
      rebuildNeeded = true;
    }

    if (config.ignoreInnerResult !== undefined) {
      this.state.ignoreInnerResult = config.ignoreInnerResult;
    }

    if (rebuildNeeded) {
      this._rebuildScopes();
    }
  }

  async process(params: any): Promise<any> {
    for (let i = 0; i < this.state.cases.length; i++) {
      const condition = this._parsedConditions[i];
      if (condition === null || condition === "syntax-error") {
        continue;
      }
      const met = await evalExpression(condition, { params }, this.app);
      if (met) {
        this.app.notify(this, { matched: i });
        return this._runPipeline(i, this.state.cases[i].pipeline, params);
      }
    }

    if (this.state.default.length > 0) {
      this.app.notify(this, { matched: "default" });
      return this._runPipeline(this.state.cases.length, this.state.default, params);
    }
    this.app.notify(this, { matched: null });
    return params;
  }

  destroy(): void {
    this._teardownScopes();
  }

  getInnerInstance(instanceId: string): any {
    for (const scope of this._scopes) {
      const svc = scope?.findServiceInstance(instanceId)[0];
      if (svc) {
        return svc;
      }
    }
    return null;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _branchPipeline(branch: number | "default"): PipelineEntry[] | null {
    if (branch === "default") {
      return this.state.default;
    }
    return this.state.cases[branch]?.pipeline ?? null;
  }

  private _setBranchPipeline(
    branch: number | "default",
    pipeline: PipelineEntry[],
  ): void {
    if (branch === "default") {
      this.state.default = pipeline;
      this.app.notify(this, { default: this.state.default });
    } else {
      this.state.cases = this.state.cases.map((c, i) =>
        i === branch ? { ...c, pipeline } : c,
      );
      this.app.notify(this, { cases: this.state.cases });
    }
  }

  private _configureBranch(config: any): void {
    const branch: number | "default" =
      config.branch === "default" ? "default" : Number(config.branch);
    const current = this._branchPipeline(branch);
    if (current === null) {
      return;
    }

    if (typeof config.when === "string" && branch !== "default") {
      this.state.cases = this.state.cases.map((c, i) =>
        i === branch ? { ...c, when: config.when } : c,
      );
      this._parsedConditions[branch] = config.when
        ? parseExpression(config.when)
        : null;
      this.app.notify(this, { cases: this.state.cases });
    }

    if (Array.isArray(config.pipeline)) {
      this._setBranchPipeline(branch, normalizePipeline(config.pipeline));
      this._rebuildScopes();
    } else if (config.appendService) {
      this._setBranchPipeline(branch, [
        ...current,
        ...normalizePipeline([config.appendService]),
      ]);
      this._rebuildScopes();
    } else if (typeof config.removeService === "string") {
      this._setBranchPipeline(
        branch,
        current.filter((e) => e.instanceId !== config.removeService),
      );
      this._rebuildScopes();
    } else if (config.configureService) {
      const { instanceId, state } = config.configureService;
      const live = this.getInnerInstance(instanceId);
      if (live?.configure) {
        live.configure(state);
        Promise.resolve(
          live.getConfiguration ? live.getConfiguration() : live.state,
        ).then((updatedState: any) => {
          this._setBranchPipeline(
            branch,
            current.map((e) =>
              e.instanceId === instanceId ? { ...e, state: updatedState } : e,
            ),
          );
        });
      } else {
        this._setBranchPipeline(
          branch,
          current.map((e) =>
            e.instanceId === instanceId
              ? { ...e, state: { ...e.state, ...state } }
              : e,
          ),
        );
      }
    }
  }

  private async _runPipeline(
    index: number,
    pipeline: PipelineEntry[],
    params: any,
  ): Promise<any> {
    if (pipeline.length === 0) {
      return params;
    }
    if (!this._scopes[index]) {
      await this._scopesBuilding;
    }
    const scope = this._scopes[index];
    if (!scope) {
      return params;
    }
    const result = await scope.next(null, params, null, false);
    return this.state.ignoreInnerResult ? params : result;
  }

  private _teardownScopes(): void {
    this._scopes = [];
    this._scopesBuilding = null;
    this._scopeGeneration++;
  }

  private _rebuildScopes(): void {
    const generation = ++this._scopeGeneration;
    this._scopes = [];

    const pipelines = [
      ...this.state.cases.map((c) => c.pipeline),
      this.state.default,
    ];

    this._scopesBuilding = (async () => {
      const scopes: Array<BrowserRuntimeScope | null> = [];
      for (const pipeline of pipelines) {
        scopes.push(pipeline.length > 0 ? await this._buildScope(pipeline) : null);
      }
      if (generation !== this._scopeGeneration) {
        return;
      }
      this._scopes = scopes;
      this.app.notify(this, { __innerScopesReady: true });
    })();
  }

  private async _buildScope(pipeline: PipelineEntry[]): Promise<BrowserRuntimeScope> {
    const registry = new BrowserRegistry();
    const scope = new BrowserRuntimeScope(
      {
        id: `switch-inner-${this.uuid}-${crypto.randomUUID()}`,
        name: "Switch Pipeline",
        type: "browser" as RuntimeClassType,
      },
      registry,
    );

    // Propagate runtime variables up through the scope hierarchy
    scope.app.getRuntimeVariable = () => this.app.getRuntimeVariable();
    scope.app.setRuntimeVariable = (key: string, value: any) =>
      this.app.setRuntimeVariable(key, value);

    for (const entry of pipeline) {
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
    new Switch(app, board, descriptor, id),
  createUI: SwitchUI,
};

export default descriptor;
