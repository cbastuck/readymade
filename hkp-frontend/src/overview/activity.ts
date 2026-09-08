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
 */
import { RuntimeScope } from "hkp-frontend/src/types";
import { OverviewEdge, OverviewNode } from "./graph";
import { previewValue } from "./preview";

/** How long a node stays lit after the call that lit it returned. */
export const COOLDOWN_MS = 800;
/** How long a pulse takes to travel one edge. */
export const PULSE_MS = 520;

export type NodeActivity = {
  /** Set while a call is in flight, cleared when it returns. */
  startedAt?: number;
  /** When the node stops being lit, if no further call arrives. */
  litUntil: number;
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
  target: { uuid: string };
  callback: (notification: any) => void;
};

export class ActivityTracker {
  private byUuid = new Map<string, NodeActivity>();
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
      const target = { uuid: node.uuid };
      const callback = (notification: any) =>
        this.onNotification(node.uuid, notification);
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

  private entry(uuid: string): NodeActivity {
    let found = this.byUuid.get(uuid);
    if (!found) {
      found = { litUntil: 0, calls: 0 };
      this.byUuid.set(uuid, found);
    }
    return found;
  }

  private onNotification(uuid: string, notification: any) {
    const internal = notification?.__internal;
    if (!internal) {
      return;
    }

    const now = performance.now();
    const activity = this.entry(uuid);

    if (internal.state === "call-process") {
      activity.startedAt = now;
      activity.litUntil = now + COOLDOWN_MS;
      activity.calls += 1;
      // What the runtime handed the service: the input it is about to work
      // on, and the half of what a service did that a result cannot explain
      // on its own.
      activity.lastIn = capture(internal.data, now);
      return;
    }

    if (internal.state === "call-process-finished") {
      activity.startedAt = undefined;
      activity.litUntil = now + COOLDOWN_MS;
      activity.lastOut = capture(internal.data, now);
      activity.lastStopped =
        internal.data === null || internal.data === undefined;

      // Nothing was passed on, so nothing travels onward either — which is
      // what a stopped pipeline looks like from the outside.
      if (activity.lastStopped) {
        return;
      }
      for (const to of this.outgoing.get(uuid) ?? []) {
        this.pulses.push({ from: uuid, to, startedAt: now });
      }
    }
  }

  get(uuid: string): NodeActivity | undefined {
    return this.byUuid.get(uuid);
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
    for (const activity of this.byUuid.values()) {
      if (activity.startedAt !== undefined || activity.litUntil > now) {
        return false;
      }
    }
    return true;
  }
}
