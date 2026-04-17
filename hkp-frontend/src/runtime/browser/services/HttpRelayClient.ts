import { AppImpl, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import HttpRelayClientUI from "./HttpRelayClientUI";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";
import { fromVault } from "./base/eval";

/**
 * Service Documentation
 * Service ID: hookup.to/service/http-relay-client
 * Service Name: HTTP Relay Client
 * Input:  pass-through (relay is driven by HTTP polling, not by pipeline input)
 * Output: pass-through
 * Config: pollUrl, respondUrl, bypassAfterNumberOfPolls, pipeline
 *
 * Polls a PHP relay endpoint every 500 ms.
 * When a pending request arrives (with its query parameters), the query params
 * are run through the configured inner pipeline via a BrowserRuntimeScope.
 * The pipeline result is POSTed back to the relay as the HTTP response body.
 *
 * The inner pipeline is defined the same way as in BrowserSubService:
 *   pipeline: [{ serviceId, instanceId, serviceName?, state? }, ...]
 */

const serviceId = "hookup.to/service/http-relay-client";
const serviceName = "HTTP Relay Client";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type State = {
  pollUrl: string;
  respondUrl: string;
  authVaultKey: string;
  status: "idle" | "online" | "serving" | "offline";
  pollCount: number;
  bypassAfterNumberOfPolls: number | null;
  pipeline: PipelineEntry[];
};

const POLL_INTERVAL_MS = 500;

export class HttpRelayClient extends ServiceBase<State> {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  _scope: BrowserRuntimeScope | null = null;
  _scopeBuilding: Promise<void> | null = null;
  private _scopeGeneration = 0;
  private _tickInFlight = false;
  // Tracks IDs already run through the pipeline so a persistent .req file
  // (e.g. when _respond fails) is never processed more than once.
  private _handledIds = new Set<string>();

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      pollUrl: "",
      respondUrl: "",
      authVaultKey: "",
      status: "idle",
      pollCount: 0,
      bypassAfterNumberOfPolls: 100,
      pipeline: [],
    });

    // Override ServiceBase's arrow-function property so toggling bypass
    // actually starts/stops the polling loop.
    this.setBypass = (bypass: boolean) => {
      this.bypass = !!bypass;
      this.app.notify(this as any, { bypass: this.bypass });
      if (bypass) {
        this._stopPolling();
      } else {
        // Always reset and restart unconditionally — don't guard on `changed`
        // so that re-enabling after auto-bypass always produces a clean state.
        this.state.pollCount = 0;
        this.app.notify(this as any, { pollCount: 0 });
        if (this.state.pollUrl && this.state.respondUrl) {
          this._startPolling();
        }
      }
    };
  }

  configure(config: any) {
    if (config?.bypass !== undefined) {
      this.setBypass(config.bypass === true);
      // Do not return here — fall through so pipeline and URLs are also applied
      // when restoring from a full saved state that includes bypass alongside other fields.
    }

    if (config?.bypassAfterNumberOfPolls !== undefined) {
      this.state.bypassAfterNumberOfPolls =
        config.bypassAfterNumberOfPolls === null ||
        config.bypassAfterNumberOfPolls === 0
          ? null
          : Math.max(1, Math.floor(Number(config.bypassAfterNumberOfPolls)));
      this.app.notify(this as any, {
        bypassAfterNumberOfPolls: this.state.bypassAfterNumberOfPolls,
      });
      // Apply immediately if the current count already meets or exceeds the new limit.
      if (
        !this.bypass &&
        this.state.bypassAfterNumberOfPolls !== null &&
        this.state.pollCount >= this.state.bypassAfterNumberOfPolls
      ) {
        this.setBypass(true);
        return this.state;
      }
    }

    // If currently bypassed, don't start anything — just update stored state.
    if (this.bypass) {
      if (config?.pollUrl !== undefined) {
        this.state.pollUrl = config.pollUrl;
      }
      if (config?.respondUrl !== undefined) {
        this.state.respondUrl = config.respondUrl;
      }
      if (config?.authVaultKey !== undefined) {
        this.state.authVaultKey = config.authVaultKey;
      }
      if (Array.isArray(config?.pipeline)) {
        this.state.pipeline = config.pipeline;
      }
      return this.state;
    }

    let rebuildScope = false;
    let restartPoll = false;

    if (config?.pollUrl !== undefined) {
      this.state.pollUrl = config.pollUrl;
      restartPoll = true;
    }
    if (config?.respondUrl !== undefined) {
      this.state.respondUrl = config.respondUrl;
      restartPoll = true;
    }
    if (config?.authVaultKey !== undefined) {
      this.state.authVaultKey = config.authVaultKey;
    }

    if (Array.isArray(config?.pipeline)) {
      this.state.pipeline = config.pipeline.map((entry: any) => ({
        serviceId: entry.serviceId,
        instanceId: entry.instanceId || entry.uuid || crypto.randomUUID(),
        ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
        ...(entry.state ? { state: entry.state } : {}),
      }));
      rebuildScope = true;
    } else if (config?.appendService) {
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
      rebuildScope = true;
    } else if (typeof config?.removeService === "string") {
      this.state.pipeline = this.state.pipeline.filter(
        (e) => e.instanceId !== config.removeService,
      );
      rebuildScope = true;
    } else if (config?.configureService) {
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
      return this.state;
    }

    if (rebuildScope) {
      this._rebuildScope();
    }

    if (restartPoll) {
      if (this.state.pollUrl && this.state.respondUrl) {
        this._startPolling();
      } else {
        this._stopPolling();
      }
    }

    return this.state;
  }

  getInnerInstance(instanceId: string) {
    return this._scope?.findServiceInstance(instanceId)[0] ?? null;
  }

  // Pass-through — the relay is source-driven by polling, not by pipeline input.
  process(data: any) {
    return data;
  }

  destroy() {
    this._stopPolling();
    this._scope = null;
    this._scopeBuilding = null;
  }

  // ── Scope ──────────────────────────────────────────────────────────────────

  private _rebuildScope() {
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
      { id: "relay-scope", name: "Relay Scope", type: "browser" },
      registry,
    );

    // We only care about the direct return value of scope.next().
    // Use a no-op instead of null so the scope never tries to call a null function.
    scope.onResult = async () => {};

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

  private async _runPipeline(input: any): Promise<any> {
    if (!this._scope) {
      await this._scopeBuilding;
    }
    if (!this._scope) {
      return input;
    }
    return this._scope.next(null, input, null, false);
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  private _startPolling() {
    this._stopPolling();
    this.pollTimer = setInterval(() => this._tick(), POLL_INTERVAL_MS);
    this._setStatus("online");
  }

  private _stopPolling() {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this._handledIds.clear();
    this.state.pollCount = 0;
    this._setStatus("idle");
  }

  private async _tick() {
    if (this._tickInFlight || !this.state.pollUrl || this.bypass) {
      return;
    }
    this._tickInFlight = true;
    try {
      const res = await fetch(this.state.pollUrl, {
        cache: "no-store",
        headers: this._authHeaders(),
      });
      if (!res.ok) {
        this._setStatus("offline");
        return;
      }

      const text = (await res.text()).trim();
      this.state.pollCount++;
      this.app.notify(this as any, { pollCount: this.state.pollCount });

      if (
        this.state.bypassAfterNumberOfPolls !== null &&
        this.state.pollCount >= this.state.bypassAfterNumberOfPolls
      ) {
        this.setBypass(true);
        return;
      }

      if (!text) {
        if (this.state.status !== "online") {
          this._setStatus("online");
        }
        return;
      }

      const { id, params } = JSON.parse(text) as {
        id: string;
        params: Record<string, string>;
      };

      // Skip IDs already handled — protects against a persistent .req file
      // when _respond fails or is still in-flight from a previous tick.
      if (this._handledIds.has(id)) {
        return;
      }

      this._setStatus("serving");
      const result = await this._runPipeline(params ?? {});

      // Mark handled BEFORE responding so that even if _respond throws,
      // the same request is never processed a second time.
      this._handledIds.add(id);
      // Keep the set small — we only need to remember recent IDs.
      if (this._handledIds.size > 20) {
        this._handledIds.delete(this._handledIds.values().next().value!);
      }

      await this._respond(id, result);
      this._setStatus("online");
    } catch {
      this._setStatus("offline");
    } finally {
      this._tickInFlight = false;
    }
  }

  private _authHeaders(): Record<string, string> {
    if (!this.state.authVaultKey) {
      return {};
    }
    const token = fromVault(this.state.authVaultKey);
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }

  private async _respond(id: string, result: any) {
    if (!this.state.respondUrl) {
      return;
    }
    try {
      await fetch(`${this.state.respondUrl}?id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this._authHeaders() },
        body: JSON.stringify(result),
      });
    } catch {
      // best-effort; serve.php will time out on its own
    }
  }

  private _setStatus(status: State["status"]) {
    if (this.state.status === status) {
      return;
    }
    this.state.status = status;
    this.app.notify(this as any, { status });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new HttpRelayClient(app, board, descriptor, id),
  createUI: HttpRelayClientUI as any,
};

export default descriptor;
