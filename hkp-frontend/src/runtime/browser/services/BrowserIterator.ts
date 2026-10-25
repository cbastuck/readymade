/**
 * Service Documentation
 * Service ID: iterator
 * Service Name: Iterator
 * Modes: one pass of the nested pipeline per item
 * Key Config: itemsFrom, limit, pipeline, bypass
 * IO: in=an array, or a single item -> out=the results, or nothing at all
 *
 * Iteration as a service, so a board can express it without a service having to
 * grow its own loop.
 *
 * A pipeline pass carries one value, which is a problem for anything that
 * produces several: a query returns twenty rows, a feed forty entries. Iterator
 * runs its nested pipeline once per item and collects the answers, so iterating
 * is a service you can see in the board rather than a loop buried in whichever
 * service happened to need it first.
 *
 * **A single item is an array of one**, so a board that grows from one value to
 * several does not change shape. What the nested pipeline returns for an item is
 * collected, and an item whose pipeline **stopped** contributes nothing — so a
 * filter-shaped sub-pipeline makes this a filter. Nothing collected at all stops
 * the outer pipeline here.
 *
 * Items are taken one at a time, each awaited before the next begins, and each
 * runs as a run of its own beneath the one that reached the Iterator.
 *
 * Everything about the pipeline itself — building it, editing it, reaching a
 * service inside it, what it may hold — is a SubService's, which is what this
 * is: the same scope, entered once per item rather than once.
 *
 * Matches `iterator` in hkp-node, hkp-python and hkp-rt.
 */

import { AppImpl, ServiceClass } from "hkp-frontend/src/types";
import { nestedRun } from "hkp-frontend/src/runtime/processContext";
import { BrowserSubService } from "./BrowserSubService";
import IteratorUI from "./IteratorUI";

const serviceId = "iterator";
const serviceName = "Iterator";

/** What this service keeps beside the scope it is. */
type Iteration = {
  itemsFrom: string;
  limit: number;
  lastItems: number;
  lastFailed: number;
};

/** The value at a dotted path, or undefined where the path does not lead. */
export function valueAt(input: unknown, path: string): unknown {
  let current: unknown = input;
  for (const step of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[step];
  }
  return current;
}

export class BrowserIterator extends BrowserSubService {
  constructor(app: AppImpl, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id);
    // Kept in the scope's own state rather than beside it, so that what a
    // board saves of this service — the scope's configuration — carries it.
    Object.assign(this.state, {
      itemsFrom: "",
      limit: 0,
      lastItems: 0,
      lastFailed: 0,
    } satisfies Iteration);
  }

  get iteration(): Iteration {
    return this.state as unknown as Iteration;
  }

  configure(config: Parameters<BrowserSubService["configure"]>[0] & Partial<Iteration>): void {
    const changed: Partial<Iteration> = {};
    if (typeof config.itemsFrom === "string") {
      changed.itemsFrom = config.itemsFrom;
    }
    if (typeof config.limit === "number" && config.limit >= 0) {
      changed.limit = Math.floor(config.limit);
    }
    if (Object.keys(changed).length > 0) {
      Object.assign(this.state, changed);
      this.app.notify(this as any, changed);
    }
    // The pipeline, bypass and the editing commands belong to the base.
    super.configure(config);
  }

  async process(input: any): Promise<any> {
    // Before anything is awaited: the run this call is in is only this call's
    // until it gives up control.
    const run = this.app.currentContext?.(this);

    if (!this._scope) {
      await this._scopeBuilding;
    }
    const scope = this._scope;
    if (!scope || this.state.pipeline.length === 0) {
      // Nothing to run the items through: what an empty SubService does.
      return this.state.stopPropagation ? null : input;
    }

    const items = this.items(input);
    const results: unknown[] = [];
    let failed = 0;
    for (const item of items) {
      try {
        // A run of its own per item, descended from the run that reached the
        // Iterator. Collected here, so not reported through onResult as well.
        const result = await scope.next(null, item, nestedRun(run), false, false);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.app.log(this, "error", "service.failed", {
          message: `iterator item failed: ${message}`,
        });
      }
    }

    Object.assign(this.state, { lastItems: items.length, lastFailed: failed });
    this.app.notify(this as any, {
      items: items.length,
      results: results.length,
      failed,
      lastItems: items.length,
      lastFailed: failed,
    });

    if (this.state.stopPropagation) {
      return null;
    }
    return results.length > 0 ? results : null;
  }

  /**
   * What to iterate over. `itemsFrom` reaches into a result that says more than
   * the list itself — `{ rows, count }` rather than a bare array.
   */
  private items(input: unknown): unknown[] {
    const { itemsFrom, limit } = this.iteration;
    const source = itemsFrom ? valueAt(input, itemsFrom) : input;
    if (source === null || source === undefined) {
      return [];
    }
    const list = Array.isArray(source) ? source : [source];
    return limit > 0 ? list.slice(0, limit) : list;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, cls: ServiceClass, id: string) =>
    new BrowserIterator(app, board, cls, id),
  createUI: IteratorUI,
};

export default descriptor;
