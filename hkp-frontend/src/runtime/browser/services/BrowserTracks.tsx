/**
 * Service Documentation
 * Service ID: tracks
 * Service Name: Tracks
 * Modes: serial | parallel
 * Key Config: tracks, reduce, run, bypass
 *
 * Several pipelines over one input, and one answer out.
 *
 * `iterator` runs one pipeline over many items; this is the other half of that
 * pair. A board that has to do two unrelated things with the same value has
 * otherwise to put them in a row and teach each of them to pass its input
 * through — which works, and records nothing: not that they are siblings rather
 * than a sequence, not in which order they may run, not which answer matters.
 *
 *     input ──┬── track ── answer ──┬── reduce ── output
 *             ├── track ── answer ──┤
 *             └── track ── answer ──┘
 *
 * Every track is given the same input and none can see another's answer. The
 * answers come back as an array with one element per track, in declaration
 * order, nulls included — a track that stopped leaves a hole, so position still
 * names the track that produced it.
 *
 * `run` says whether that happens one at a time (the default) or all at once.
 * Two tracks writing to the same place are a race the moment they overlap, so
 * concurrency is asked for rather than discovered.
 *
 * `reduce` is a pipeline, given `{ input, results }` — the value the tracks ran
 * on and what they answered. Carrying on as though the tracks were side effects
 * is `{"=": "params.input"}`. With no reducer the answers travel on as they
 * are, and a reducer returning null stops the pipeline as any service does.
 *
 * Matches `tracks` in hkp-node, hkp-python and hkp-rt.
 */

import {
  AppImpl,
  RuntimeClassType,
  ServiceClass,
  ServiceInstance,
} from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import BrowserRegistry from "../BrowserRegistry";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { addService, configureService } from "../BrowserRuntimeApi";

const serviceId = "tracks";
const serviceName = "Tracks";

/** The name the reducer answers to; a track may not take it. */
const REDUCE = "reduce";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

type TrackState = {
  name: string;
  bypass?: boolean;
  pipeline: PipelineEntry[];
};

type State = {
  run: "serial" | "parallel";
  tracks: TrackState[];
  reduce: PipelineEntry[];
};

export class BrowserTracks extends ServiceBase<State> {
  /** One live scope per track, plus the reducer's, keyed by track name. */
  private _scopes = new Map<string, BrowserRuntimeScope>();
  /** Guards against a stale build finishing after a newer configure. */
  private _generation = 0;
  private _building: Promise<void> | null = null;

  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { run: "serial", tracks: [], reduce: [] });
  }

  configure(
    config: Partial<State> & {
      bypass?: boolean;
      track?: string;
      pipeline?: PipelineEntry[];
      appendService?: PipelineEntry;
      removeService?: string;
      configureService?: { instanceId: string; state: Record<string, any> };
    },
  ): void {
    // An edit naming a track is about one pipeline under this service rather
    // than about the service; without it there is no way to say which.
    if (typeof config.track === "string") {
      this._configureTrack(config.track, config);
      return;
    }

    let changed = false;

    if (config.run === "serial" || config.run === "parallel") {
      this.state.run = config.run;
      changed = true;
    }
    if (Array.isArray(config.tracks)) {
      this.state.tracks = config.tracks.map((track, index) => ({
        name: typeof track?.name === "string" && track.name ? track.name : `${index}`,
        ...(track?.bypass ? { bypass: true } : {}),
        pipeline: normalize(track?.pipeline),
      }));
      changed = true;
    }
    if (Array.isArray(config.reduce)) {
      this.state.reduce = normalize(config.reduce);
      changed = true;
    }
    if (typeof config.bypass === "boolean") {
      this.setBypass(config.bypass);
    }

    if (changed) {
      this._rebuild();
      this.app.notify(this as any, {
        tracks: this.state.tracks,
        reduce: this.state.reduce,
        run: this.state.run,
      });
    }
  }

  async process(input: any): Promise<any> {
    if (this.bypass || this.state.tracks.length === 0) {
      return input;
    }
    if (this._building) {
      await this._building;
    }

    const results =
      this.state.run === "parallel"
        ? await Promise.all(this.state.tracks.map((track) => this._runTrack(track, input)))
        : await this._serially(input);

    const reducer = this._scopes.get(REDUCE);
    if (!reducer || this.state.reduce.length === 0) {
      return results;
    }
    return reducer.next(null, { input, results }, null, false, false);
  }

  /** Ends every pass running inside any track or the reduce. */
  cancelInFlight(): void {
    for (const scope of this._scopes.values()) {
      scope.cancelInFlight();
    }
  }

  /**
   * The live instance of a nested service, wherever it sits.
   *
   * Asked by instance id alone, because that is what a panel has: which track a
   * service belongs to is this service's business, not the panel's.
   */
  getInnerInstance(instanceId: string): ServiceInstance | null {
    for (const scope of this._scopes.values()) {
      const found = scope.findServiceInstance(instanceId)[0];
      if (found) {
        return found;
      }
    }
    return null;
  }

  destroy(): void {
    this._scopes.clear();
    this._generation++;
    this._building = null;
  }

  // -------------------------------------------------------------------------

  /** Applies a pipeline edit to one track, or to the reducer. */
  private _configureTrack(
    name: string,
    config: {
      bypass?: boolean;
      pipeline?: PipelineEntry[];
      appendService?: PipelineEntry;
      removeService?: string;
      configureService?: { instanceId: string; state: Record<string, any> };
    },
  ): void {
    const track =
      name === REDUCE ? null : this.state.tracks.find((t) => t.name === name);
    if (name !== REDUCE && !track) {
      return;
    }
    const current = () => (track ? track.pipeline : this.state.reduce);
    const replace = (pipeline: PipelineEntry[]) => {
      if (track) {
        track.pipeline = pipeline;
      } else {
        this.state.reduce = pipeline;
      }
    };

    if (typeof config.bypass === "boolean" && track) {
      track.bypass = config.bypass;
    }

    if (Array.isArray(config.pipeline)) {
      replace(normalize(config.pipeline));
    } else if (config.appendService) {
      replace([...current(), ...normalize([config.appendService])]);
    } else if (typeof config.removeService === "string") {
      replace(current().filter((e) => e.instanceId !== config.removeService));
    } else if (config.configureService) {
      const { instanceId, state } = config.configureService;
      const live = this.getInnerInstance(instanceId);
      if (live?.configure) {
        // The instance is running: hand it the raw config so command-shaped
        // edits keep their meaning instead of being merged in as inert state.
        live.configure(state);
        Promise.resolve(
          live.getConfiguration ? live.getConfiguration() : (live as any).state,
        ).then((updated) => {
          replace(
            current().map((e) =>
              e.instanceId === instanceId ? { ...e, state: updated } : e,
            ),
          );
          this.app.notify(this as any, { __innerScopeReady: true });
        });
        return;
      }
      replace(
        current().map((e) =>
          e.instanceId === instanceId
            ? { ...e, state: { ...e.state, ...state } }
            : e,
        ),
      );
    }

    this._rebuild();
    this.app.notify(this as any, {
      tracks: this.state.tracks,
      reduce: this.state.reduce,
      run: this.state.run,
    });
  }

  private async _serially(input: any): Promise<any[]> {
    const results: any[] = [];
    for (const track of this.state.tracks) {
      results.push(await this._runTrack(track, input));
    }
    return results;
  }

  /**
   * One track's answer, or null where it has none. A track that throws is
   * reported and leaves a hole rather than taking the others down with it.
   */
  private async _runTrack(track: TrackState, input: any): Promise<any> {
    const scope = this._scopes.get(track.name);
    if (track.bypass || !scope || track.pipeline.length === 0) {
      return null;
    }
    try {
      // Collected for the reduce, so not reported through onResult as well.
      return await scope.next(null, input, null, false, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pushErrorNotification(`track '${track.name}' failed: ${message}`);
      return null;
    }
  }

  private _rebuild(): void {
    const generation = ++this._generation;
    this._scopes.clear();

    this._building = (async () => {
      const built = new Map<string, BrowserRuntimeScope>();
      for (const track of this.state.tracks) {
        built.set(track.name, await this._buildScope(track.name, track.pipeline));
      }
      if (this.state.reduce.length > 0) {
        built.set(REDUCE, await this._buildScope(REDUCE, this.state.reduce));
      }
      if (generation !== this._generation) {
        return; // superseded by a newer configure()
      }
      this._scopes = built;
      this.app.notify(this as any, { __innerScopeReady: true });
    })();
  }

  private async _buildScope(
    label: string,
    pipeline: PipelineEntry[],
  ): Promise<BrowserRuntimeScope> {
    const scope = new BrowserRuntimeScope(
      {
        id: `${this.uuid}:${label}`,
        name: `${serviceName}:${label}`,
        type: "browser" as RuntimeClassType,
      },
      new BrowserRegistry(),
    );

    // A service inside a track that emits without being called — a Timer tick,
    // a socket — has its own answer to give; it leaves by the same door this
    // service's output does.
    scope.onResult = async (_instanceId, result) => {
      if (result !== null && result !== undefined) {
        this.app.next(this, result);
      }
    };

    // Notifications from inside reach the outer app, so a nested service's
    // panel updates like any other; nesting deeper composes the same way.
    const outerNotify = this.app.notify.bind(this.app);
    const innerNotify = scope.app.notify.bind(scope.app);
    scope.app.notify = (svc: any, notification: any) => {
      innerNotify(svc, notification);
      outerNotify(svc, notification);
    };

    for (const entry of pipeline) {
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

function normalize(pipeline: unknown): PipelineEntry[] {
  if (!Array.isArray(pipeline)) {
    return [];
  }
  return pipeline.map((entry: any) => ({
    serviceId: entry.serviceId,
    instanceId: entry.instanceId || entry.uuid || crypto.randomUUID(),
    ...(entry.serviceName ? { serviceName: entry.serviceName } : {}),
    ...(entry.state ? { state: entry.state } : {}),
  }));
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, cls: ServiceClass, id: string) =>
    new BrowserTracks(app, board, cls, id),
};

export default descriptor;
