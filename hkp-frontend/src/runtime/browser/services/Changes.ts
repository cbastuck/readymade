/**
 * Service Documentation
 * Service ID: hookup.to/service/changes
 * Service Name: Changes
 * Modes: emit change | rise | fall
 * Key Config: value (expression over params; empty watches the whole input), emit
 * IO: in=any -> out=the same input when the watched value changed, else null
 */

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import ChangesUI from "./ChangesUI";
import { EMIT_MODES, EmitMode } from "./changes-modes";
import {
  evalExpression,
  Expression,
  parseExpression,
  SyntaxError,
} from "./base/eval";

const serviceId = "hookup.to/service/changes";
const serviceName = "Changes";

type State = {
  /** An expression over `params`; empty watches the input itself. */
  value: string;
  emit: EmitMode;
};

/**
 * Whether JSON has nothing to say about an object: one that is not plain data
 * and has no fields of its own to write — a Blob, an ArrayBuffer, an ImageData.
 * All of these serialise to `{}`, whatever they hold.
 */
function isOpaque(value: object): boolean {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype === Object.prototype || prototype === null) {
    return false;
  }
  return Object.keys(value).length === 0;
}

const opaqueIds = new WeakMap<object, number>();
let nextOpaqueId = 0;

/** Writes an opaque object as a token of its own, so it equals only itself. */
function distinguishOpaque(_key: string, value: unknown): unknown {
  if (typeof value !== "object" || !value || !isOpaque(value)) {
    return value;
  }
  let id = opaqueIds.get(value);
  if (id === undefined) {
    id = nextOpaqueId++;
    opaqueIds.set(value, id);
  }
  return `\u0000opaque:${id}`;
}

/**
 * What an object says, as text the next value's is compared with — taken when
 * the value arrives, so an object changed afterwards by whoever made it is
 * still compared with what it said then. `undefined` for what has no such
 * text: anything but an object, and an object that cannot be written.
 */
function fingerprint(value: unknown): string | undefined {
  if (typeof value !== "object" || !value) {
    return undefined;
  }
  try {
    return JSON.stringify(value, distinguishOpaque);
  } catch {
    return undefined;
  }
}

type Remembered = { value: unknown; print: string | undefined };

/**
 * Values compared by what they say, so an object rebuilt each time is not a
 * change, and one reused with other content is. What cannot be read this way
 * (see `isOpaque`) is compared by identity instead, on its own or inside
 * another value: a new one is a change.
 */
function same(a: Remembered, b: Remembered): boolean {
  if (a.print !== undefined || b.print !== undefined) {
    return a.print === b.print;
  }
  return Object.is(a.value, b.value);
}

/**
 * Lets an input through only when what it watches has changed since the last
 * input — the step that turns a stream of reports ("a face is there", every
 * frame) into events ("a face appeared").
 *
 * The remembered value is live state, like a Timer's `running`: it is not
 * saved with the board, so a board opened again starts from nothing seen.
 * Before the first input the remembered value is `undefined`, which is falsy:
 * a first value that is truthy is a rise, and any first value is a change.
 */
class Changes extends ServiceBase<State> {
  __remembered: unknown = undefined;
  __rememberedPrint: string | undefined = undefined;
  __seen = false;
  __expression: Expression | SyntaxError | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { value: "", emit: "change" });
  }

  /** What the panel shows as remembered; `seen` false while nothing has arrived. */
  get remembered(): { seen: boolean; value: unknown } {
    return { seen: this.__seen, value: this.__remembered };
  }

  configure(config: Partial<State> & { reset?: boolean }) {
    if (config.value !== undefined && config.value !== this.state.value) {
      this.state.value = config.value;
      this.__expression = config.value.trim() ? parseExpression(config.value) : null;
      if (this.__expression === "syntax-error") {
        this.pushErrorNotification(`Changes: cannot read "${config.value}"`);
      }
      // What was remembered was a value of the old expression.
      this.forget();
      this.app.notify(this, { value: config.value });
    }
    if (config.emit !== undefined && EMIT_MODES.includes(config.emit)) {
      this.state.emit = config.emit;
      this.app.notify(this, { emit: config.emit });
    }
    if (config.reset) {
      this.forget();
    }
  }

  private forget() {
    this.__remembered = undefined;
    this.__rememberedPrint = undefined;
    this.__seen = false;
    this.app.notify(this, { remembered: this.remembered });
  }

  async process(params: any): Promise<any> {
    if (params === undefined) {
      return null;
    }
    let current: unknown = params;
    if (this.__expression === "syntax-error") {
      return null;
    }
    if (this.__expression) {
      try {
        current = await evalExpression(this.__expression, { params }, this.app, this);
      } catch (err: any) {
        this.pushErrorNotification(`Changes: ${err?.message ?? err}`);
        return null;
      }
    }

    const previous = this.__remembered;
    const print = fingerprint(current);
    const changed =
      !this.__seen ||
      !same({ value: previous, print: this.__rememberedPrint }, { value: current, print });
    this.__remembered = current;
    this.__rememberedPrint = print;
    this.__seen = true;
    if (changed) {
      this.app.notify(this, { remembered: this.remembered });
    }

    switch (this.state.emit) {
      case "rise":
        return !previous && !!current ? params : null;
      case "fall":
        return !!previous && !current ? params : null;
      default:
        return changed ? params : null;
    }
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
  ) => new Changes(app, board, descriptor, id),
  createUI: ChangesUI,
};
