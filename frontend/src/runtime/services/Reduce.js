import {
  parseExpression, 
  evalExpression,
} from 'services';

const serviceId = 'hookup.to/service/reduce';
const serviceName = 'Reduce';

class Reduce {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.initialState = undefined;
    this.reducer = "";
    this.property = "";
    this.reducedState = undefined;
    this._reduceExpression = undefined;
  }

  configure(config) {
    const { 
      initialState, 
      reducer,
      property,
      resetReducer=false,
    } = config;

    if (initialState !== undefined) {
      this.initialState = initialState;
      this.reducedState = initialState;
      this.app.notify(this, { reducedState: this.reducedState });
    }

    if (reducer !== undefined) {
      this._reduceExpression = parseExpression(reducer);
      this.app.notify(this, { reducer });
    }

    if (property !== undefined) {
      this.property = property
      this.app.notify(this, { property });
    }

    if (resetReducer) {
      this.reducedState = this.initialState;
    }
  }

  process(_params) {
    if (!this._reduceExpression) {
      return _params;
    }
    const params = { params: { value: _params, acc: this.reducedState } };
    this.reducedState = evalExpression(this._reduceExpression, params);
    if (!this.property) {
      return this.reducedState;
    }
    return {
      [this.property]: this.reducedState
    };
  }
}


const descriptor = {
  serviceName: serviceName,
  serviceId: serviceId,
  create: (app, board, descriptor, id) =>
    new Reduce(app, board, descriptor, id),
  createUI: undefined
};

export default descriptor;
