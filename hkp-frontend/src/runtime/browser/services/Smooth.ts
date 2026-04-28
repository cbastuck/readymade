import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SmoothUI from "./SmoothUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/smooth
 * Service Name: Smooth
 * Input:  number | object with numeric fields
 * Output: same shape as input, values blended toward the input each frame
 * Config: factor (0–1) — how quickly current tracks target (0 = frozen, 1 = instant)
 *
 * Maintains a running "current" value and applies EMA each frame:
 *   current += (target - current) * factor
 * On the first frame the current is initialized to the input directly.
 * A reset() call (via configure({ reset: true })) clears the current value.
 */

const serviceId = "hookup.to/service/smooth";
const serviceName = "Smooth";

type State = { factor: number };

class Smooth extends ServiceBase<State> {
  private current: any = undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { factor: 0.1 });
  }

  configure(config: any) {
    if (config?.factor !== undefined) {
      this.state.factor = Math.max(0, Math.min(1, Number(config.factor)));
      this.app.notify(this, { factor: this.state.factor });
    }
    if (config?.reset) {
      this.current = undefined;
    }
    return this.state;
  }

  process(params: any): any {
    if (params == null) {
      return params;
    }

    if (this.current === undefined) {
      this.current = deepCopy(params);
      return this.current;
    }

    const { factor } = this.state;

    if (typeof params === "number") {
      this.current += (params - this.current) * factor;
      return this.current;
    }

    if (typeof params === "object") {
      for (const key of Object.keys(params)) {
        const target = params[key];
        if (typeof target === "number") {
          const cur =
            typeof this.current[key] === "number" ? this.current[key] : target;
          this.current[key] = cur + (target - cur) * factor;
        } else {
          this.current[key] = target;
        }
      }
      return this.current;
    }

    return params;
  }
}

function deepCopy(x: any): any {
  if (typeof x === "object" && x !== null) {
    return { ...x };
  }
  return x;
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Smooth(app, board, descriptor, id),
  createUI: SmoothUI,
};

export default descriptor;
