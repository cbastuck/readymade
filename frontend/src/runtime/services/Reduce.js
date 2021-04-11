const serviceId = 'hookup.to/service/reduce';
const serviceName = 'Reduce';

class ReducedValues {
  collect(item, skip=[]) {
    Object.keys(item).forEach(key => {
      if (skip.indexOf(key) === -1) {
        if (this[key] === undefined) {
          this[key] = {};
        }
        const entry = this[key];
        const value = item[key];
        if (entry[value] === undefined) {
          entry[value] = 1;
        } else {
          ++entry[value];
        }
      }
    });
    return this;
  }
}

class Reduce {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { reduceKey } = config;

    if (reduceKey !== undefined) {
      this.reduceKey = reduceKey;
      this.app.notify(this, { reduceKey });
    }
  }

  process(params) {
    if (!Array.isArray(params) || !this.reduceKey) {
      return params;
    }
    
    return params
      .reduce(
        (reducedParams, paramsItem) => {
          if (!paramsItem) {
            return reducedParams;
          }
          const reduceKeyValue = paramsItem[this.reduceKey];
          const reducedValues = reducedParams[reduceKeyValue] || new ReducedValues();
          return { 
            ...reducedParams, 
            [reduceKeyValue]: reducedValues.collect(paramsItem, [this.reduceKey]),
          };
        }, 
        {}
      );
  } 
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Reduce(app, board, descriptor, id),
};

export default descriptor;
