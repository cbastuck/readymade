import { parseExpression, evalExpression } from "./eval";

const serviceId = "hookup.to/service/reduce";
const serviceName = "Reduce";

class Reduce {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.initialState = undefined;
    this.reducer = "";
    this.reducedState = undefined;
    this._reduceExpression = undefined;
  }

  configure(config) {
    const { initialState, reducer, resetReducer = false } = config;

    let reducedStateChanged = false;
    if (initialState !== undefined) {
      this.initialState = initialState;
      this.reducedState = initialState;
      reducedStateChanged = true;
    }

    if (reducer !== undefined) {
      this.reducer = reducer;
      this._reduceExpression = parseExpression(reducer);
      this.app.notify(this, { reducer });
    }

    if (resetReducer) {
      this.reducedState = this.initialState;
      reducedStateChanged = true;
    }

    if (reducedStateChanged) {
      this.app.notify(this, { reducedState: this.reducedState });
    }
  }

  process(_params) {
    if (!this._reduceExpression) {
      return _params;
    }
    const params = { params: { value: _params, acc: this.reducedState } };
    this.reducedState = evalExpression(this._reduceExpression, params);
    this.app.notify(this, { reducedState: this.reducedState });
    return this.reducedState;
  }
}

export default {
  serviceName,
  serviceId,
  service: Reduce,
};
