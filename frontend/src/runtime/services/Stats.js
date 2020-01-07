const serviceId = 'hookup.to/service/stats';
const serviceName = 'Stats';

class Stats {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.generation = 0;
    this.population = [];
  }

  configure(config) {
    this.property = config.property;
  }

  process(params) {
    if (!this.property && params) {
      return params;
    }

    if (!Array.isArray(params)) {
      return this.process([params]);
    }

    const stats = params.reduce(
      (acc, cur) => {
        const val = cur[this.property];
        if (val === undefined) {
          return acc;
        }
        return { ...acc, mean: acc.mean + val, n: acc.n + 1 };
      }, 
      {
        type: 'meta',
        n: 0,
        mean: 0 
      }
    );

    stats.mean /= stats.n;  
    return [stats].concat(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Stats(app, board, descriptor, id),
};

export default descriptor;
