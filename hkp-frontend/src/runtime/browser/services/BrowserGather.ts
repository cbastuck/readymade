/**
 * Service Documentation
 * Service ID: gather
 * Service Name: Gather
 * Modes: none — the items as an array, or what the nested pipeline makes of them
 * Key Config: pipeline, maxBytes, maxGroups, timeoutMs, bypass
 * IO: in=one part a Spread sent on -> out=the whole group, once every part is in; null until then
 *
 * The other half of Spread. Spread turns one array into as many values as it
 * has items, each sent on by itself; Gather waits until it has seen them all
 * and turns them back into one — here, for a board whose parts were spread by a
 * runtime before this one.
 *
 * **A part says which whole it belongs to**: `{ item, group, index, total }`.
 * Parts may arrive in any order and a part sent twice counts once. Until a group
 * is complete nothing is passed on. Anything that is not a part passes through,
 * so the same Gather sits on a board that sometimes sends a value whole.
 *
 * **What the group becomes is a pipeline, not a list of strategies** — the same
 * answer Tracks gives its reducer. With none the items travel on as an array;
 * with one, the pipeline is given `{ group, items }` and its answer goes on.
 *
 * **Collecting a group holds it in memory.** `maxBytes` bounds one group,
 * `maxGroups` how many may be incomplete at once — so the most held is the two
 * multiplied — and a group still incomplete after `timeoutMs` is let go; each is
 * logged and reported as `error`, because a group that never arrives looks,
 * from outside, exactly like nothing having been sent.
 *
 * Matches `gather` in hkp-node, hkp-python and hkp-rt.
 */

import { AppImpl, ServiceClass } from "hkp-frontend/src/types";
import { nestedRun } from "hkp-frontend/src/runtime/processContext";
import { BrowserSubService } from "./BrowserSubService";
import GatherUI from "./GatherUI";

const serviceId = "gather";
const serviceName = "Gather";

/** As much as the coordinator lets through in one frame by default. */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
/**
 * Groups incomplete at once. A new group beyond it is refused rather than
 * making room: what is already arriving is not given up for what arrives next.
 */
const DEFAULT_MAX_GROUPS = 16;
/**
 * Refusals remembered at once, the oldest forgotten first. They expire anyway;
 * this keeps a stream of new groups, each refused, from growing the list
 * instead of the groups.
 */
export const MAX_REFUSED = 1024;
/**
 * The longest group a part may name. A group is held as long as its parts are,
 * and is not counted against `maxBytes`; Spread names its groups by UUID.
 */
export const MAX_GROUP_LENGTH = 256;

/** One item of an array a Spread sent on, and where it sits in it. */
export type Part = {
  item: unknown;
  group: string;
  index: number;
  total: number;
};

/** Whether a value is a part, rather than a value to pass through. */
export function isPart(value: unknown): value is Part {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const part = value as Record<string, unknown>;
  return (
    "item" in part &&
    typeof part.group === "string" &&
    part.group !== "" &&
    part.group.length <= MAX_GROUP_LENGTH &&
    Number.isInteger(part.total) &&
    (part.total as number) > 0 &&
    Number.isInteger(part.index) &&
    (part.index as number) >= 0 &&
    (part.index as number) < (part.total as number)
  );
}

/** What a part costs to hold, near enough to bound memory by. */
function sizeOf(item: unknown): number {
  if (typeof item === "string") {
    return new TextEncoder().encode(item).byteLength;
  }
  if (item instanceof Uint8Array || item instanceof ArrayBuffer) {
    return item.byteLength;
  }
  if (item === null || item === undefined) {
    return 0;
  }
  try {
    return new TextEncoder().encode(JSON.stringify(item) ?? "").byteLength;
  } catch {
    return 0;
  }
}

type Collecting = {
  /**
   * By index rather than an array of `total`: a part names its own total, and
   * an array that size would be allocated — or refused outright — before a
   * second part had arrived.
   */
  items: Map<number, unknown>;
  total: number;
  bytes: number;
  startedAt: number;
};

/** What this service keeps beside the scope it is. */
type Collection = {
  maxBytes: number;
  maxGroups: number;
  timeoutMs: number;
};

export class BrowserGather extends BrowserSubService {
  private collecting = new Map<string, Collecting>();
  /**
   * Groups given up on, and when. The parts of a group still on their way when
   * it was refused would otherwise start it again, and wait out the timeout
   * for parts that went with the refusal.
   */
  private refused = new Map<string, number>();
  private lastError = "";

  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id);
    // Kept in the scope's own state rather than beside it, so that what a
    // board saves of this service — the scope's configuration — carries it.
    Object.assign(this.state, {
      maxBytes: DEFAULT_MAX_BYTES,
      maxGroups: DEFAULT_MAX_GROUPS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    } satisfies Collection);
  }

  get collection(): Collection {
    return this.state as unknown as Collection;
  }

  /** How many groups are incomplete, and the last one refused or let go. */
  get progress(): { pending: number; error: string } {
    return { pending: this.collecting.size, error: this.lastError };
  }

  configure(config: Parameters<BrowserSubService["configure"]>[0] & Partial<Collection>): void {
    const changed: Partial<Collection> = {};
    if (typeof config.maxBytes === "number" && config.maxBytes > 0) {
      changed.maxBytes = Math.floor(config.maxBytes);
    }
    if (typeof config.maxGroups === "number" && config.maxGroups >= 1) {
      changed.maxGroups = Math.floor(config.maxGroups);
    }
    if (typeof config.timeoutMs === "number" && config.timeoutMs > 0) {
      changed.timeoutMs = Math.floor(config.timeoutMs);
    }
    if (Object.keys(changed).length > 0) {
      Object.assign(this.state, changed);
      this.app.notify(this as any, changed);
    }
    // The pipeline, bypass and the editing commands belong to the base.
    super.configure(config);
  }

  async process(input: any): Promise<any> {
    if (!isPart(input)) {
      return input;
    }
    // Before anything is awaited: the run this call is in is only this call's
    // until it gives up control.
    const run = this.app.currentContext?.(this);

    const now = Date.now();
    this.letGoOfStale(now);

    const { group, index, total, item } = input;
    if (this.refused.has(group)) {
      return null;
    }

    let collecting = this.collecting.get(group);
    if (!collecting) {
      const { maxGroups } = this.collection;
      if (this.collecting.size >= maxGroups) {
        this.refuse(
          group,
          now,
          `group ${group} refused: ${maxGroups} groups are already incomplete`,
        );
        return null;
      }
      collecting = {
        items: new Map(),
        total,
        bytes: 0,
        startedAt: now,
      };
      this.collecting.set(group, collecting);
    }

    if (collecting.total !== total) {
      this.refuse(group, now, `group ${group} said ${collecting.total} parts, then ${total}`);
      return null;
    }
    if (collecting.items.has(index)) {
      // Sent twice; the first one counts.
      return null;
    }

    collecting.bytes += sizeOf(item);
    if (collecting.bytes > this.collection.maxBytes) {
      this.refuse(group, now, `group ${group} is larger than ${this.collection.maxBytes} bytes`);
      return null;
    }

    collecting.items.set(index, item);
    this.app.notify(this as any, {
      group,
      received: collecting.items.size,
      total,
      pending: this.collecting.size,
    });

    if (collecting.items.size < total) {
      return null;
    }

    this.collecting.delete(group);
    const items = Array.from({ length: total }, (_, i) => collecting.items.get(i));
    if (!this._scope) {
      await this._scopeBuilding;
    }
    const scope = this._scope;
    if (!scope || this.state.pipeline.length === 0) {
      return this.state.stopPropagation ? null : items;
    }
    // The run that brought the last part is the one the whole arrives in; the
    // pipeline making it runs as a run of its own beneath it, like a scope's.
    const result = await scope.next(
      null,
      { group, items },
      nestedRun(run),
      false,
      false,
    );
    return this.state.stopPropagation ? null : result;
  }

  destroy(): void {
    this.collecting.clear();
    this.refused.clear();
    super.destroy();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private refuse(group: string, now: number, message: string): void {
    this.collecting.delete(group);
    this.refused.set(group, now);
    // A Map keeps insertion order, so the first key is the oldest refusal.
    while (this.refused.size > MAX_REFUSED) {
      this.refused.delete(this.refused.keys().next().value as string);
    }
    this.lastError = message;
    this.app.log(this, "error", "gather.refused", { group, message });
    this.app.notify(this as any, { error: message, pending: this.collecting.size });
  }

  /** Lets go of groups that stopped arriving, and of refusals that are old. */
  private letGoOfStale(now: number): void {
    const { timeoutMs } = this.collection;
    for (const [group, collecting] of this.collecting) {
      if (now - collecting.startedAt > timeoutMs) {
        this.collecting.delete(group);
        this.lastError = `group ${group} timed out with ${collecting.items.size} of ${collecting.total} parts`;
        this.app.log(this, "warn", "gather.timed-out", {
          group,
          received: collecting.items.size,
          total: collecting.total,
        });
        this.app.notify(this as any, {
          error: this.lastError,
          pending: this.collecting.size,
        });
      }
    }
    for (const [group, at] of this.refused) {
      if (now - at > timeoutMs) {
        this.refused.delete(group);
      }
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, cls: ServiceClass, id: string) =>
    new BrowserGather(app, board, cls, id),
  createUI: GatherUI,
};

export default descriptor;
