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

/** Values compared by what they say, so an object rebuilt each time is not a change. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
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
        current = await evalExpression(this.__expression, { params }, this.app);
      } catch (err: any) {
        this.pushErrorNotification(`Changes: ${err?.message ?? err}`);
        return null;
      }
    }

    const previous = this.__remembered;
    const changed = !this.__seen || !same(previous, current);
    this.__remembered = current;
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
