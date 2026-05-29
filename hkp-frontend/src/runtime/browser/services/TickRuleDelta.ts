import ServiceBase from "./ServiceBase";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import TickRuleDeltaUI from "./TickRuleDeltaUI";

const serviceId = "hookup.to/service/tick-rule-delta";
const serviceName = "Tick Rule Delta";

type SymbolState = {
  prevPrice: number | null;
  buyVol: number;
  sellVol: number;
};

type State = {
  interval: number;
};

class TickRuleDelta extends ServiceBase<State> {
  private __timer: ReturnType<typeof setInterval> | null = null;
  private __symbols: Record<string, SymbolState> = {};

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { interval: 2000 });
  }

  configure(config: any): void {
    if (config.interval !== undefined) {
      this.state.interval = config.interval;
      this.app.notify(this, { interval: config.interval });
      this.__resetTimer();
    }
  }

  process(params: any): any {
    const { symbol, price, size } = params ?? {};
    if (!symbol || typeof price !== "number" || typeof size !== "number") {
      return params;
    }

    if (!this.__symbols[symbol]) {
      this.__symbols[symbol] = { prevPrice: null, buyVol: 0, sellVol: 0 };
    }
    const sym = this.__symbols[symbol];

    if (sym.prevPrice !== null) {
      if (price > sym.prevPrice) {
        sym.buyVol += size;
      } else if (price < sym.prevPrice) {
        sym.sellVol += size;
      }
      // equal price: neutral, no volume assigned
    }
    sym.prevPrice = price;
    return params;
  }

  destroy(): void {
    this.__clearTimer();
  }

  private __clearTimer(): void {
    if (this.__timer !== null) {
      clearInterval(this.__timer);
      this.__timer = null;
    }
  }

  private __resetTimer(): void {
    this.__clearTimer();
    this.__timer = setInterval(this.__flush, this.state.interval);
  }

  private __flush = (): void => {
    const delta: Record<string, number> = {};
    for (const [symbol, sym] of Object.entries(this.__symbols)) {
      const total = sym.buyVol + sym.sellVol;
      delta[symbol] = total > 0 ? (sym.buyVol - sym.sellVol) / total : 0;
      // volumes accumulate — interval only controls UI notification frequency
    }
    this.app.notify(this, delta);
  };
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new TickRuleDelta(app, board, descriptor, id),
  createUI: TickRuleDeltaUI,
};

export default descriptor;
