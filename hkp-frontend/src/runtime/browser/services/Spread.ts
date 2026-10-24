/**
 * Service Documentation
 * Service ID: hookup.to/service/spread
 * Service Name: Spread
 * Modes: none
 * Key Config: itemsFrom
 * IO: in=an array, or a single item -> out=one { item, group, index, total } per item, each sent on by itself
 *
 * One value in, as many out as it has items.
 *
 * A pipeline pass carries one value, and so does a value leaving a runtime:
 * an array of a hundred chunks crosses to the next runtime as one message, as
 * large as the file it was cut from. Spread sends each item down the rest of
 * the board on its own — the services after it, and the runtimes after this
 * one — so each crosses as a message of its own. A coordinator that drops a
 * message above its frame limit then sees a hundred small ones instead.
 *
 * It is not an Iterator. An Iterator runs a pipeline of its own once per item
 * and comes back with their answers, so one value still leaves it. Spread holds
 * no pipeline: what follows it on the board is what each item goes through,
 * and nothing comes back. It returns null and continues the run itself, once
 * per item — the pull pattern — so every item goes on in the run that reached
 * it, and with the caller that run carries.
 *
 * **Each item goes on wrapped**, as `{ item, group, index, total }`: the item
 * itself, untouched, and where it sat in the array. That is what lets a Gather
 * on the far side put the array back together, in order, once it has seen the
 * whole group; a service in between reads the item as `params.item`.
 *
 * **A single item is an array of one**, as for an Iterator, so a board fed
 * sometimes one value and sometimes several does not change shape.
 */

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SpreadUI from "./SpreadUI";
import { generateUUID } from "./helpers";

const serviceId = "hookup.to/service/spread";
const serviceName = "Spread";

type State = {
  itemsFrom: string;
};

/** The value at a dotted path, or undefined where the path does not lead. */
function valueAt(input: unknown, path: string): unknown {
  let current: unknown = input;
  for (const step of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[step];
  }
  return current;
}

class Spread extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { itemsFrom: "" });
  }

  configure(config: Partial<State>) {
    if (typeof config.itemsFrom === "string") {
      this.state.itemsFrom = config.itemsFrom;
      this.app.notify(this, { itemsFrom: config.itemsFrom });
    }
  }

  async process(input: any): Promise<null> {
    const items = this.items(input);
    if (items.length > 0) {
      const group = generateUUID();
      const total = items.length;
      for (const [index, item] of items.entries()) {
        // One at a time, each awaited: the services after this one see the
        // items in order, and a hundred chunks are not all in flight at once.
        await this.app.next(this, { item, group, index, total });
      }
      this.app.notify(this, { lastTotal: total });
    }
    // Every item has gone on already; there is nothing left to pass.
    return null;
  }

  private items(input: unknown): unknown[] {
    const source = this.state.itemsFrom
      ? valueAt(input, this.state.itemsFrom)
      : input;
    if (source === null || source === undefined) {
      return [];
    }
    return Array.isArray(source) ? source : [source];
  }
}

export default {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Spread(app, board, descriptor, id),
  createUI: SpreadUI,
};
