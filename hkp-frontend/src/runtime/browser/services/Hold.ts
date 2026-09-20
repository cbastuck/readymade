/**
 * Service Documentation
 * Service ID: hookup.to/service/hold
 * Service Name: Hold
 * Modes: none — either a slot with a declared role, or a property that discriminates
 * Key Config: slot + op, or property
 * IO: in=any -> out=the held value, or null while nothing is held
 *
 * Sample-and-hold: a pipeline entered from two sides — a producer that runs on
 * its own schedule and a consumer that arrives whenever it arrives — needs the
 * producer's latest value to survive between runs. Hold keeps it.
 *
 * **Which side is calling can be said two ways**, and a board picks one.
 *
 * With a `slot`, the board says outright: `op` is `write` or `read`, and two
 * Holds naming one slot are the two ends of it. Nothing inspects the value, so
 * anything can be held — bytes, a document, null — and the two ends may sit in
 * pipelines that never meet. Where the cells live is the runtime's to decide:
 * the scope holding both pipelines, or failing that the runtime.
 *
 * With a `property` and no slot, the input says: an input carrying that
 * property is the producer, its value replaces what is held, and every call —
 * that one included — emits the held value under the same property name, so
 * the services after Hold cannot tell the two sides apart. It is the only one
 * available where the two sides share one pipeline, since there is nothing but
 * the value to tell them apart. A null held value is an empty one, so a
 * producer cannot hold null: an input carrying the property as null reads like
 * any other.
 *
 * Mirrors hkp-node's src/services/hold.ts, hkp-python's services/hold.py and
 * hkp-rt's services/hold.h.
 */
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import HoldUI from "./HoldUI";

const serviceId = "hookup.to/service/hold";
const serviceName = "Hold";

/** Longer than this and what is held is described rather than reported. */
const REPORTABLE_LIMIT = 2048;

type State = {
  property: string;
  slot: string;
  op: "read" | "write";
};

class Hold extends ServiceBase<State> {
  /** What is held when no slot names somewhere else to hold it. */
  private own: unknown = null;
  private readCount = 0;
  private writeCount = 0;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { property: "", slot: "", op: "read" });
  }

  configure(config: Partial<State> & { action?: string }) {
    if (typeof config.property === "string") {
      if (config.property !== this.state.property) {
        // What is held belongs to the property it was written for.
        this.forget();
      }
      this.state.property = config.property;
    }

    if (typeof config.slot === "string") {
      if (config.slot !== this.state.slot) {
        // A slot is an address, and what was held belongs to the old one — but
        // it belongs to whoever else is still reading it, so only this
        // service's own cell is cleared, never the runtime's.
        this.own = null;
        this.readCount = 0;
        this.writeCount = 0;
      }
      this.state.slot = config.slot;
    }

    if (config.op === "read" || config.op === "write") {
      this.state.op = config.op;
    }

    if (config.action === "clear") {
      this.forget();
    }

    this.report();
  }

  process(input: unknown): unknown {
    if (this.state.slot) {
      return this.useSlot(input);
    }

    // Nothing named is nothing to hold: an unconfigured Hold is a wire.
    if (!this.state.property) {
      return input;
    }

    const incoming = carriedValue(input, this.state.property);
    if (incoming !== null && incoming !== undefined) {
      this.write(incoming);
      this.writeCount += 1;
    } else {
      this.readCount += 1;
    }

    this.report();

    const held = this.read();
    return held === null ? null : { [this.state.property]: held };
  }

  destroy() {
    // Only what this service holds itself. A slot belongs to the runtime, and
    // the other end of it outlives this one — a pipeline rebuilt while a board
    // is running destroys the services in it, and that must not empty a cell
    // the service on the other side is still answering from.
    this.own = null;
    this.readCount = 0;
    this.writeCount = 0;
  }

  /**
   * A call on a Hold whose role is declared rather than inferred.
   *
   * A write emits **its input unchanged**, so the pass it belongs to carries on
   * as though the Hold were not there; a read emits what is held, **raw**, so
   * it can be the whole of what a pipeline answers with. Neither looks at the
   * value, which is what lets a slot hold what a property never could.
   */
  private useSlot(input: unknown): unknown {
    if (this.state.op === "write") {
      this.write(input);
      this.writeCount += 1;
      this.report();
      return input;
    }

    this.readCount += 1;
    this.report();
    // Nothing held is nothing to pass on, the same as everywhere else — a
    // consumer that arrives before the producer has run stops here.
    return this.read() ?? null;
  }

  /** What is held, from wherever this Hold holds it. */
  private read(): unknown {
    if (!this.state.slot) {
      return this.own;
    }
    const store = this.app.slots?.();
    return (store ? store.get(this.state.slot) : this.own) ?? null;
  }

  private write(value: unknown): void {
    const store = this.state.slot ? this.app.slots?.() : null;
    if (store) {
      store.set(this.state.slot, value);
      return;
    }
    // No store to share through — a Hold in a runtime that provides none still
    // holds, for itself alone, rather than dropping what it was given.
    this.own = value;
  }

  /**
   * Back to how the service started. The counts go with the value: they say how
   * often each side has called for what is held now, and left running across a
   * clear they would describe a value that is gone.
   */
  private forget(): void {
    this.own = null;
    if (this.state.slot) {
      this.app.slots?.().set(this.state.slot, null);
    }
    this.readCount = 0;
    this.writeCount = 0;
  }

  /**
   * What this Hold is doing, for its panel.
   *
   * Only the arrangement in use is reported. A state property a service does
   * not act on is one a board keeps and a reader has to discount.
   */
  private report(): void {
    const which = this.state.slot
      ? { slot: this.state.slot, op: this.state.op }
      : { property: this.state.property };
    this.app.notify(this as any, {
      ...which,
      held: reportable(this.read()),
      readCount: this.readCount,
      writeCount: this.writeCount,
    });
  }
}

/**
 * The value an input carries for the held property, if it carries one at all —
 * anything else makes the call a read rather than a write.
 */
function carriedValue(input: unknown, property: string): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return undefined;
  }
  return (input as Record<string, unknown>)[property];
}

/**
 * What is held, as something safe to put in a notification.
 *
 * A panel draws what it is told and a board keeps it, so a value that does not
 * survive being written down is described rather than sent.
 */
function reportable(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return `[${value.byteLength} bytes]`;
  }
  try {
    const json = JSON.stringify(value);
    if (json === undefined) {
      return null;
    }
    if (json.length > REPORTABLE_LIMIT) {
      return `[${describe(value)}, ${json.length} characters]`;
    }
    return JSON.parse(json);
  } catch {
    return `[${describe(value)}]`;
  }
}

function describe(value: unknown): string {
  if (Array.isArray(value)) {
    return `array of ${value.length}`;
  }
  return typeof value;
}

export default {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Hold(app, board, descriptor, id),
  createUI: HoldUI,
};
