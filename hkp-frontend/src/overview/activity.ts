/**
 * What the board is doing right now, kept outside React.
 *
 * Every runtime brackets each call to a service with a pair of notifications —
 * `call-process` when it hands the service its input, `call-process-finished`
 * with the result — and the browser receives that pair for local and remote
 * runtimes alike. The same signal drives the glow on a service card; here it
 * drives the colour of a node and the pulses travelling the edges out of it.
 *
 * This is deliberately not component state. The pair arrives once per service
 * per run, which for a board driven by a timer or an audio stream is far more
 * often than a view should re-render; the render loop reads this on the frame
 * it is already drawing.
 *
 * A runtime only sends a notification for a service something is listening to,
 * so a tracker that did not register would see a silent board — registering for
 * every node is what makes the ones with no panel on screen report at all.
 *
 * Registering is by *address*, not by uuid: a scope forwards what happens
 * inside it under the path through the services containing it, since an
 * instanceId is only unique within its own pipeline. Listening for the bare
 * name of a nested service is listening for something nobody says, which is
 * a scope that runs and reports nothing.
 */
import { RuntimeScope } from "hkp-frontend/src/types";
import { OverviewEdge, OverviewNode } from "./graph";
import { previewValue } from "./preview";

/** How long a node stays lit after the call that lit it returned. */
export const COOLDOWN_MS = 800;
/**
 * How long, and how brightly, a node flickers after a call that passed nothing
 * on. It was asked — a Filter that blocked, a Timeline outside its placement —
 * and the view says so, but faintly. Lit as fully as a call that produced
 * something, a service asked every frame and answering null every frame would
 * look as busy as the ones doing the work.
 */
export const STOPPED_COOLDOWN_MS = 250;
export const STOPPED_HEAT = 0.25;
/** How long a pulse takes to travel one edge. */
export const PULSE_MS = 520;

export type NodeActivity = {
  /** Set while a call is in flight, cleared when it returns. */
  startedAt?: number;
  /** When the node stops being lit, if no further call arrives. */
  litUntil: number;
  /** When the faint flicker of a call that passed nothing on is over. */
  stoppedUntil?: number;
  /** How many calls this node has been given since the view opened. */
  calls: number;
  /** What the last call was given, and what it answered with. */
  lastIn?: Payload;
  lastOut?: Payload;
  /** Whether the last call returned nothing, which stops the pipeline. */
  lastStopped?: boolean;
};

/** What crossed a service's edge, kept as text rather than as itself. */
export type Payload = {
  /** What it was, in a few characters. */
  summary: string;
  /** What it held, up to a budget. */
  preview: string;
  /** When it crossed, so the panel can say how long ago. */
  at: number;
};

export type Pulse = {
  from: string;
  to: string;
  startedAt: number;
};

/**
 * A value as the panel keeps it: described and rendered to a budget.
 *
 * Nothing here holds on to the value itself: a pipeline pushing buffers would
 * otherwise be kept alive one frame at a time by the view watching it.
 */
function capture(value: unknown, at: number): Payload {
  return {
    summary: describeResult(value),
    preview: previewValue(value),
    at,
  };
}

/** Describes a result in a few characters, without holding on to it. */
export function describeResult(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `string ${value.length}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Float32Array || value instanceof Uint8Array) {
    return `${value.constructor.name} ${value.length}`;
  }
  if (value instanceof ArrayBuffer) {
    return `bytes ${value.byteLength}`;
  }
  if (Array.isArray(value)) {
    return `array ${value.length}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return `object ${keys.length}`;
  }
  return typeof value;
}

type Registration = {
  app: { unregisterNotificationTarget?: (svc: any, cb: any) => void };
  target: { uuid: string; address?: string };
  callback: (notification: any) => void;
};

export class ActivityTracker {
  /** By node key: a uuid alone would merge copies of one nested block. */
  private byKey = new Map<string, NodeActivity>();
  private pulses: Pulse[] = [];
  private outgoing = new Map<string, string[]>();
  private registrations: Registration[] = [];

  /**
   * Starts listening for every node in the scene. Returns the function that
   * stops again; calling this a second time replaces the first subscription.
   */
  attach(
    nodes: OverviewNode[],
    edges: OverviewEdge[],
    scopes: { [runtimeId: string]: RuntimeScope },
  ): () => void {
    this.detach();

    this.outgoing = new Map();
    for (const edge of edges) {
      // Containment is a place a pipeline sits, not a hop data takes; a pulse
      // along one would claim a handover that never happened.
      if (edge.kind === "contains") {
        continue;
      }
      const list = this.outgoing.get(edge.from) ?? [];
      list.push(edge.to);
      this.outgoing.set(edge.from, list);
    }

    for (const node of nodes) {
      const app = scopes[node.runtimeId]?.getApp?.() as any;
      if (!app?.registerNotificationTarget) {
        continue;
      }
      // What the service is called where it lives, and where to listen for
      // it: the path through the services containing it, which is what a
      // scope forwards under. A service the runtime holds itself is already
      // at its own address, and says so by leaving this out.
      const target: Registration["target"] = { uuid: node.uuid };
      if (node.ancestry.length > 0) {
        target.address = node.key;
      }
      const callback = (notification: any) =>
        this.onNotification(node.key, notification);
      app.registerNotificationTarget(target, callback);
      this.registrations.push({ app, target, callback });
    }

    return () => this.detach();
  }

  detach() {
    for (const { app, target, callback } of this.registrations) {
      app.unregisterNotificationTarget?.(target, callback);
    }
    this.registrations = [];
  }

  private entry(key: string): NodeActivity {
    let found = this.byKey.get(key);
    if (!found) {
      found = { litUntil: 0, calls: 0 };
      this.byKey.set(key, found);
    }
    return found;
  }

  private onNotification(key: string, notification: any) {
    const internal = notification?.__internal;
    if (!internal) {
      return;
    }

    const now = performance.now();
    const activity = this.entry(key);

    if (internal.state === "call-process") {
      // Lit while in flight by `startedAt`; how long after is up to what the
      // call answers.
      activity.startedAt = now;
      activity.calls += 1;
      // What the runtime handed the service: the input it is about to work
      // on, and the half of what a service did that a result cannot explain
      // on its own.
      activity.lastIn = capture(internal.data, now);
      return;
    }

    if (internal.state === "call-process-finished") {
      activity.startedAt = undefined;
      activity.lastOut = capture(internal.data, now);
      activity.lastStopped =
        internal.data === null || internal.data === undefined;

      // Nothing was passed on, so nothing travels onward either — which is
      // what a stopped pipeline looks like from the outside. Only a flicker:
      // an earlier call's glow, still fading, is left to fade.
      if (activity.lastStopped) {
        activity.stoppedUntil = now + STOPPED_COOLDOWN_MS;
        return;
      }
      activity.litUntil = now + COOLDOWN_MS;
      for (const to of this.outgoing.get(key) ?? []) {
        this.pulses.push({ from: key, to, startedAt: now });
      }
    }
  }

  get(key: string): NodeActivity | undefined {
    return this.byKey.get(key);
  }

  /** Drops pulses that have arrived, and returns the ones still travelling. */
  livePulses(now: number): Pulse[] {
    if (this.pulses.length > 0) {
      this.pulses = this.pulses.filter((p) => now - p.startedAt < PULSE_MS);
    }
    return this.pulses;
  }

  /** Whether anything is lit or moving, so an idle board can stop redrawing. */
  isQuiet(now: number): boolean {
    if (this.pulses.length > 0) {
      return false;
    }
    for (const activity of this.byKey.values()) {
      if (heatOf(activity, now) > 0) {
        return false;
      }
    }
    return true;
  }
}

/**
 * How lit a node is, from 0 to 1: fully while a call is in flight, fading back
 * over the cooldown after one that passed something on, and only as far as
 * STOPPED_HEAT after one that did not.
 */
export function heatOf(activity: NodeActivity, now: number): number {
  if (activity.startedAt !== undefined) {
    return 1;
  }
  const lit = Math.max(0, (activity.litUntil - now) / COOLDOWN_MS);
  const stopped =
    activity.stoppedUntil === undefined
      ? 0
      : Math.max(0, (activity.stoppedUntil - now) / STOPPED_COOLDOWN_MS) *
        STOPPED_HEAT;
  return Math.max(lit, stopped);
}
